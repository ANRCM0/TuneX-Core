package adp3

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/tunex/vnext/agent/internal/contracts"
)

func resourceSnapshot(t *testing.T, extension bool) map[string]any {
	t.Helper()
	raw, err := os.ReadFile("../../../packages/contracts/fixtures/adp-v3-runtime.json")
	if err != nil {
		t.Fatal(err)
	}
	var fixture struct {
		Cases []struct {
			Schema, Raw string
			Valid       bool
		}
	}
	if err := json.Unmarshal(raw, &fixture); err != nil {
		t.Fatal(err)
	}
	var value map[string]any
	for _, item := range fixture.Cases {
		if item.Valid && item.Schema == "Snapshot" {
			if err := json.Unmarshal([]byte(item.Raw), &value); err != nil {
				t.Fatal(err)
			}
			break
		}
	}
	if value == nil {
		t.Fatal("valid Snapshot fixture missing")
	}
	if extension {
		value["executionExtension"] = 1
	}
	assignment := value["assignments"].([]any)[0].(map[string]any)
	value["resourceLimits"] = map[string]any{"version": 1, "buckets": []any{map[string]any{
		"bucketId": "bucket-a", "scopeId": "scope", "actorId": "owner", "nodeId": value["nodeId"], "revision": 1,
		"startsAt": "2026-10-12T08:00:00.000Z", "endsAt": "2026-10-12T08:00:01.000Z",
		"bytesPerSecond": 10, "burstBytes": 10, "byteLimit": 100, "assignmentIds": []any{assignment["assignmentId"]},
	}}}
	return value
}

func resourceBuckets(value map[string]any) []any {
	return value["resourceLimits"].(map[string]any)["buckets"].([]any)
}
func resourceBucket(value map[string]any) map[string]any {
	return resourceBuckets(value)[0].(map[string]any)
}

func resourceEncoding(t *testing.T, value map[string]any) []byte {
	t.Helper()
	delete(value, "snapshotDigest")
	digest, err := contracts.ComputeDigest(value)
	if err != nil {
		t.Fatal(err)
	}
	value["snapshotDigest"] = digest
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

func TestResourceLimitsOptionalWireAndDigestCoverage(t *testing.T) {
	for _, extension := range []bool{false, true} {
		name := "runtime"
		if extension {
			name = "execution"
		}
		t.Run(name, func(t *testing.T) {
			old := resourceSnapshot(t, extension)
			delete(old, "resourceLimits")
			parsed, err := Parse("Snapshot", resourceEncoding(t, old))
			if err != nil {
				t.Fatal(err)
			}
			if parsed.(Snapshot).ResourceLimits != nil {
				t.Fatal("old wire gained a bucket")
			}
			value := resourceSnapshot(t, extension)
			if _, err := Parse("Snapshot", resourceEncoding(t, value)); err != nil {
				t.Fatal(err)
			}
			resourceBucket(value)["byteLimit"] = 101
			raw, err := json.Marshal(value)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := Parse("Snapshot", raw); err == nil || !strings.Contains(err.Error(), "Snapshot digest differs") {
				t.Fatal("policy was not digest covered", err)
			}
		})
	}
}

func TestResourceLimitsClosedWireFieldsAndRequiredValues(t *testing.T) {
	cases := map[string]func(map[string]any){
		"policy-field":  func(v map[string]any) { v["resourceLimits"].(map[string]any)["extra"] = true },
		"bucket-field":  func(v map[string]any) { resourceBucket(v)["extra"] = true },
		"missing":       func(v map[string]any) { delete(resourceBucket(v), "byteLimit") },
		"version":       func(v map[string]any) { v["resourceLimits"].(map[string]any)["version"] = 2 },
		"empty-buckets": func(v map[string]any) { v["resourceLimits"].(map[string]any)["buckets"] = []any{} },
		"zero-burst":    func(v map[string]any) { resourceBucket(v)["burstBytes"] = 0 },
		"unlimited": func(v map[string]any) {
			resourceBucket(v)["bytesPerSecond"] = nil
			resourceBucket(v)["byteLimit"] = nil
		},
	}
	for _, extension := range []bool{false, true} {
		for name, mutate := range cases {
			t.Run(name+map[bool]string{false: "/runtime", true: "/execution"}[extension], func(t *testing.T) {
				value := resourceSnapshot(t, extension)
				mutate(value)
				if _, err := Parse("Snapshot", resourceEncoding(t, value)); err == nil {
					t.Fatal("closed wire accepted")
				}
			})
		}
	}
}

func TestResourceLimitsNodeReferencesSubjectAndCanonicalOrder(t *testing.T) {
	for _, extension := range []bool{false, true} {
		for _, mode := range []string{"node", "unknown", "duplicate-assignment", "assignment-order", "duplicate-subject", "duplicate-bucket", "bucket-order", "cross-bucket-assignment"} {
			t.Run(mode+map[bool]string{false: "/runtime", true: "/execution"}[extension], func(t *testing.T) {
				value := resourceSnapshot(t, extension)
				bucket := resourceBucket(value)
				assignments := value["assignments"].([]any)
				raw, err := json.Marshal(assignments[0])
				if err != nil {
					t.Fatal(err)
				}
				var second map[string]any
				if err := json.Unmarshal(raw, &second); err != nil {
					t.Fatal(err)
				}
				second["assignmentId"], second["forwardId"] = "zz-assignment", "zz-forward"
				second["resource"].(map[string]any)["port"] = second["resource"].(map[string]any)["port"].(float64) + 1
				value["assignments"] = append(assignments, second)
				references := bucket["assignmentIds"].([]any)
				switch mode {
				case "node":
					bucket["nodeId"] = "foreign-node"
				case "unknown":
					bucket["assignmentIds"] = []any{"unknown"}
				case "duplicate-assignment":
					bucket["assignmentIds"] = append(references, references[0])
				case "assignment-order":
					bucket["assignmentIds"] = []any{second["assignmentId"], references[0]}
				default:
					other := map[string]any{}
					for key, field := range bucket {
						other[key] = field
					}
					other["bucketId"], other["actorId"], other["assignmentIds"] = "bucket-b", "owner-b", []any{}
					if mode == "duplicate-subject" {
						other["actorId"] = bucket["actorId"]
					}
					if mode == "duplicate-bucket" {
						other["bucketId"] = bucket["bucketId"]
					}
					if mode == "cross-bucket-assignment" {
						other["assignmentIds"] = references
					}
					buckets := []any{bucket, other}
					if mode == "bucket-order" {
						buckets = []any{other, bucket}
					}
					value["resourceLimits"].(map[string]any)["buckets"] = buckets
				}
				if _, err := Parse("Snapshot", resourceEncoding(t, value)); err == nil {
					t.Fatal("invalid binding/order accepted")
				}
			})
		}
	}
}

func TestResourceLimitsEmptyControlBucketGrantsNoAssignment(t *testing.T) {
	for _, extension := range []bool{false, true} {
		value := resourceSnapshot(t, extension)
		old := value["assignments"].([]any)[0].(map[string]any)
		resource := old["resource"].(map[string]any)
		value["tombstones"] = []any{map[string]any{"assignmentId": old["assignmentId"], "forwardId": old["forwardId"],
			"role": old["role"], "protocol": old["protocol"], "physicalProtocol": resource["protocol"], "port": resource["port"],
			"bindingFence": old["bindingFence"], "retirementGeneration": value["snapshotGeneration"]}}
		value["assignments"] = []any{}
		resourceBucket(value)["assignmentIds"] = []any{}
		parsed, err := Parse("Snapshot", resourceEncoding(t, value))
		if err != nil {
			t.Fatal(err)
		}
		snapshot := parsed.(Snapshot)
		if len(snapshot.Assignments) != 0 || len(snapshot.ResourceLimits.Buckets[0].AssignmentIds) != 0 {
			t.Fatal("control bucket granted execution")
		}
		if len(snapshot.Tombstones) != 1 {
			t.Fatal("control bucket erased original drain tombstone")
		}
	}
}

func TestResourceLimitsCanonicalMillisecondsAndExactLegacyFractions(t *testing.T) {
	for _, extension := range []bool{false, true} {
		for _, start := range []string{"2026-10-12T08:00:00Z", "2026-10-12T08:00:00.0000Z", "2026-10-12T09:00:00.000+01:00"} {
			value := resourceSnapshot(t, extension)
			resourceBucket(value)["startsAt"] = start
			if _, err := Parse("Snapshot", resourceEncoding(t, value)); err == nil {
				t.Fatal("noncanonical bucket time accepted", start)
			}
		}
		for _, item := range []struct {
			issued, start, end string
			valid              bool
		}{
			{"2026-10-12T08:00:00Z", "2026-10-12T08:00:00.000Z", "2026-10-12T08:00:00.001Z", true},
			{"2026-10-12T08:00:00.000999999999999999999Z", "2026-10-12T08:00:00.000Z", "2026-10-12T08:00:00.001Z", true},
			{"2026-10-12T08:00:00.000999999999999999999Z", "2026-10-12T08:00:00.001Z", "2026-10-12T08:00:01.000Z", false},
			{"2026-10-12T08:00:00.001000000000000000001Z", "2026-10-12T08:00:00.000Z", "2026-10-12T08:00:00.001Z", false},
			{"2026-10-12T08:00:00.001Z", "2026-10-12T08:00:00.000Z", "2026-10-12T08:00:00.001Z", false},
		} {
			value := resourceSnapshot(t, extension)
			value["issuedAt"] = item.issued
			resourceBucket(value)["startsAt"], resourceBucket(value)["endsAt"] = item.start, item.end
			_, err := Parse("Snapshot", resourceEncoding(t, value))
			if (err == nil) != item.valid {
				t.Fatalf("issued=%s valid=%v err=%v", item.issued, item.valid, err)
			}
		}
	}
}
