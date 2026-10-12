// Package contracts validates the exact ADP/2 wire contract before typed decoding.
package contracts

import (
	"bytes"
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/netip"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"unicode/utf8"

	jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
	"github.com/santhosh-tekuri/jsonschema/v6"
)

//go:embed schema.json
var schemaBytes []byte
var compiled map[string]*jsonschema.Schema
var compileError error
var once sync.Once

const MaxCounter uint64 = 9007199254740991

func initialize() {
	compiler := jsonschema.NewCompiler()
	compiler.AssertFormat()
	var resource any
	if err := json.Unmarshal(schemaBytes, &resource); err != nil {
		compileError = err
		return
	}
	const schemaURL = "urn:tunex:adp:2:direct"
	if err := compiler.AddResource(schemaURL, resource); err != nil {
		compileError = err
		return
	}
	compiled = make(map[string]*jsonschema.Schema)
	for _, name := range []string{"HelloRequest", "HelloResponse", "Snapshot", "ReportRequest", "ReportAck", "ErrorResponse"} {
		schema, err := compiler.Compile(schemaURL + "#/$defs/" + name)
		if err != nil {
			compileError = err
			return
		}
		compiled[name] = schema
	}
}

var numberPattern = regexp.MustCompile(`^(-?)([0-9]+)(?:\.([0-9]+))?(?:[eE]([+-]?[0-9]+))?$`)

func safeInteger(token string) bool {
	if len(token) > 128 {
		return false
	}
	parts := numberPattern.FindStringSubmatch(token)
	if parts == nil {
		return false
	}
	coefficient, ok := new(big.Int).SetString(parts[2]+parts[3], 10)
	if !ok {
		return false
	}
	if coefficient.Sign() == 0 {
		return true
	}
	exponent := int64(0)
	if parts[4] != "" {
		exponent, _ = strconv.ParseInt(parts[4], 10, 32)
		if exponent > 256 || exponent < -256 {
			return false
		}
	}
	scale := exponent - int64(len(parts[3]))
	if scale > 16 || scale < -128 {
		return false
	}
	if scale >= 0 {
		coefficient.Mul(coefficient, new(big.Int).Exp(big.NewInt(10), big.NewInt(scale), nil))
	} else {
		divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(-scale), nil)
		remainder := new(big.Int)
		coefficient.QuoRem(coefficient, divisor, remainder)
		if remainder.Sign() != 0 {
			return false
		}
	}
	return coefficient.Cmp(new(big.Int).SetUint64(MaxCounter)) <= 0
}

func readValue(decoder *json.Decoder, depth int) (any, error) {
	if depth > 64 {
		return nil, fmt.Errorf("RESOURCE_LIMIT: JSON nesting too deep")
	}
	token, err := decoder.Token()
	if err != nil {
		return nil, err
	}
	switch value := token.(type) {
	case json.Delim:
		switch value {
		case '{':
			object := make(map[string]any)
			for decoder.More() {
				key, err := decoder.Token()
				if err != nil {
					return nil, err
				}
				name, ok := key.(string)
				if !ok {
					return nil, fmt.Errorf("INVALID_CONFIG: Expected object key")
				}
				if _, exists := object[name]; exists {
					return nil, fmt.Errorf("INTEGRITY_FAILURE: Duplicate JSON key")
				}
				child, err := readValue(decoder, depth+1)
				if err != nil {
					return nil, err
				}
				object[name] = child
			}
			end, err := decoder.Token()
			if err != nil || end != json.Delim('}') {
				return nil, fmt.Errorf("INVALID_CONFIG: Invalid object ending")
			}
			return object, nil
		case '[':
			array := make([]any, 0)
			for decoder.More() {
				child, err := readValue(decoder, depth+1)
				if err != nil {
					return nil, err
				}
				array = append(array, child)
			}
			end, err := decoder.Token()
			if err != nil || end != json.Delim(']') {
				return nil, fmt.Errorf("INVALID_CONFIG: Invalid array ending")
			}
			return array, nil
		}
		return nil, fmt.Errorf("INVALID_CONFIG: Unexpected delimiter")
	case json.Number:
		if !safeInteger(string(value)) {
			return nil, fmt.Errorf("INVALID_CONFIG: Expected an exact safe integer")
		}
	}
	return token, nil
}

// ParseJSON rejects duplicates, non-I-JSON, unsafe integers and deep/oversized input before schema validation.
func ParseJSON(raw []byte, maxBytes int) (any, error) {
	if len(raw) > maxBytes {
		return nil, fmt.Errorf("RESOURCE_LIMIT: JSON body too large")
	}
	if !utf8.Valid(raw) {
		return nil, fmt.Errorf("INVALID_CONFIG: Invalid UTF-8")
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	value, err := readValue(decoder, 0)
	if err != nil {
		return nil, err
	}
	if _, err := decoder.Token(); err != io.EOF {
		return nil, fmt.Errorf("INVALID_CONFIG: Trailing JSON data")
	}
	// The pinned RFC 8785 reader additionally rejects lone UTF-16 surrogates.
	if _, err := jcs.Transform(raw); err != nil {
		return nil, fmt.Errorf("INVALID_CONFIG: %w", err)
	}
	return value, nil
}

// ValidateStructure applies only structural contract checks, keeping fixture evidence distinct from execution semantics.
func ValidateStructure(name string, raw []byte) error {
	once.Do(initialize)
	if compileError != nil {
		return compileError
	}
	schema, ok := compiled[name]
	if !ok {
		return fmt.Errorf("INVALID_CONFIG: Unknown message type")
	}
	maxBytes := 4194304
	if name == "ReportRequest" {
		maxBytes = 1048576
	}
	value, err := ParseJSON(raw, maxBytes)
	if err != nil {
		return err
	}
	if err := schema.Validate(value); err != nil {
		return fmt.Errorf("INVALID_CONFIG: Invalid %s structure: %w", name, err)
	}
	return nil
}

// ComputeDigest implements RFC 8785 JCS with the locked upstream library.
func ComputeDigest(value any) (string, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(canonical)
	return "sha256:" + hex.EncodeToString(hash[:]), nil
}

func validatePolicy(policy Policy) error {
	if policy.PollIntervalSeconds >= policy.RenewalLeadSeconds || policy.RenewalLeadSeconds >= policy.LeaseSeconds || policy.RenewalLeadSeconds <= 2*policy.PollIntervalSeconds+policy.MaxClockSkewSeconds {
		return fmt.Errorf("INVALID_CONFIG: Invalid renewal timing")
	}
	for _, value := range []uint64{policy.PollIntervalSeconds, policy.LeaseSeconds, policy.RenewalLeadSeconds, policy.MaxClockSkewSeconds, policy.ObservationFreshnessSeconds, policy.DrainTimeoutSeconds, policy.ConnectTimeoutSeconds, policy.UdpIdleTimeoutSeconds} {
		if value > MaxCounter/1000 {
			return fmt.Errorf("INVALID_CONFIG: Duration overflows milliseconds")
		}
	}
	return nil
}

var hostLabel = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$`)
var numericHost = regexp.MustCompile(`^[0-9.]+$`)

func normalizedHost(host string) (string, bool) {
	for _, char := range host {
		if char > 127 {
			return "", false
		}
	}
	if addr, err := netip.ParseAddr(host); err == nil {
		if addr.Zone() != "" || addr.Unmap().IsUnspecified() {
			return "", false
		}
		return addr.String(), true
	}
	normalized := strings.TrimSuffix(strings.ToLower(host), ".")
	if len(normalized) > 253 || numericHost.MatchString(normalized) {
		return "", false
	}
	for _, label := range strings.Split(normalized, ".") {
		if len(label) < 1 || len(label) > 63 || !hostLabel.MatchString(label) {
			return "", false
		}
	}
	return normalized, true
}

// ValidCIDR requires an IP network with zero host bits and an ordinary decimal prefix.
func ValidCIDR(value string) bool {
	parts := strings.Split(value, "/")
	if len(parts) != 2 || parts[1] == "" || (len(parts[1]) > 1 && parts[1][0] == '0') {
		return false
	}
	for _, digit := range parts[1] {
		if digit < '0' || digit > '9' {
			return false
		}
	}
	prefix, err := netip.ParsePrefix(value)
	return err == nil && prefix == prefix.Masked() && prefix.Addr().Zone() == ""
}

func compareTombstones(a, b Tombstone) int {
	if a.Protocol < b.Protocol {
		return -1
	}
	if a.Protocol > b.Protocol {
		return 1
	}
	if a.Port < b.Port {
		return -1
	}
	if a.Port > b.Port {
		return 1
	}
	if a.RetirementGeneration < b.RetirementGeneration {
		return -1
	}
	if a.RetirementGeneration > b.RetirementGeneration {
		return 1
	}
	return strings.Compare(a.AssignmentId, b.AssignmentId)
}

func validateSnapshot(snapshot Snapshot, raw []byte) error {
	order, err := compareTimes(snapshot.IssuedAt, snapshot.ValidUntil)
	if err != nil {
		return err
	}
	if order >= 0 {
		return fmt.Errorf("INVALID_CONFIG: Invalid snapshot time range")
	}
	var body map[string]json.RawMessage
	if err := json.Unmarshal(raw, &body); err != nil {
		return err
	}
	delete(body, "snapshotDigest")
	hash, err := ComputeDigest(body)
	if err != nil {
		return err
	}
	if hash != snapshot.SnapshotDigest {
		return fmt.Errorf("INTEGRITY_FAILURE: Snapshot digest mismatch")
	}
	physical := make(map[string]bool)
	logical := make(map[string]bool)
	previous := ""
	for _, assignment := range snapshot.Assignments {
		logicalKey := fmt.Sprintf("%s/%s/%s", assignment.ForwardId, assignment.Protocol, assignment.Role)
		if logical[logicalKey] {
			return fmt.Errorf("RESOURCE_CONFLICT: Duplicate logical slot")
		}
		logical[logicalKey] = true
		if assignment.AssignmentId <= previous {
			return fmt.Errorf("RESOURCE_CONFLICT: Assignments must be unique and sorted")
		}
		previous = assignment.AssignmentId
		key := fmt.Sprintf("%s/%d", assignment.Protocol, assignment.Listener.Port)
		if physical[key] {
			return fmt.Errorf("RESOURCE_CONFLICT: Conflicting physical slot")
		}
		physical[key] = true
		config := assignment.Driver.Config
		host, valid := normalizedHost(config.Target.Host)
		if !valid || host != config.Target.Host {
			return fmt.Errorf("INVALID_CONFIG: Noncanonical target host")
		}
		for _, cidr := range config.AllowedDestinationCidrs {
			if !ValidCIDR(cidr) {
				return fmt.Errorf("INVALID_CONFIG: Invalid CIDR network")
			}
		}
		hash, err := ComputeDigest(config)
		if err != nil {
			return err
		}
		if hash != assignment.Driver.ConfigDigest {
			return fmt.Errorf("INTEGRITY_FAILURE: Driver config digest mismatch")
		}
	}
	retired := make(map[string]bool)
	for index, tombstone := range snapshot.Tombstones {
		key := fmt.Sprintf("%s/%d/%d", tombstone.Protocol, tombstone.Port, tombstone.BindingFence)
		if retired[key] || tombstone.RetirementGeneration > snapshot.SnapshotGeneration {
			return fmt.Errorf("INVALID_CONFIG: Invalid retirement high-water")
		}
		retired[key] = true
		if index > 0 && compareTombstones(snapshot.Tombstones[index-1], tombstone) >= 0 {
			return fmt.Errorf("INVALID_CONFIG: Tombstones must be unique and sorted")
		}
		for _, assignment := range snapshot.Assignments {
			if assignment.Protocol == tombstone.Protocol && assignment.Listener.Port == tombstone.Port && assignment.BindingFence <= tombstone.BindingFence {
				return fmt.Errorf("FENCING_REJECTED: Assignment resurrects retired slot")
			}
		}
	}
	return nil
}

func validateReport(report ReportRequest) error {
	if _, err := utcInstant(report.ObservedAt); err != nil {
		return err
	}
	if report.AcceptedSnapshotGeneration == 0 && (len(report.Observations) > 0 || len(report.Drains) > 0) {
		return fmt.Errorf("INVALID_CONFIG: Unaccepted snapshot cannot have observations")
	}
	required := map[string]string{"ready": "active", "prepared": "prepared", "removed": "absent", "draining": "draining"}
	seen := make(map[string]bool)
	for _, obs := range report.Observations {
		key := fmt.Sprintf("%s/%d/%d", obs.AssignmentId, obs.DeploymentGeneration, obs.BindingFence)
		if seen[key] {
			return fmt.Errorf("INVALID_CONFIG: Duplicate observation")
		}
		seen[key] = true
		if phase, exists := required[obs.Condition]; exists && phase != obs.Phase {
			return fmt.Errorf("INVALID_CONFIG: Phase and condition disagree")
		}
	}
	drains := make(map[string]bool)
	for _, drain := range report.Drains {
		key := fmt.Sprintf("%s/%d/%d", drain.AssignmentId, drain.DeploymentGeneration, drain.BindingFence)
		if drains[key] {
			return fmt.Errorf("INVALID_CONFIG: Duplicate drain report")
		}
		drains[key] = true
		order, err := compareTimes(drain.StartedAt, drain.Deadline)
		if err != nil {
			return err
		}
		if order > 0 || (drain.Condition == "removed" && drain.RemainingConnections != 0) {
			return fmt.Errorf("INVALID_CONFIG: Invalid drain report")
		}
	}
	return nil
}

// ParseMessage validates structural and stateless semantic rules. Identity/session/lease/fence state belongs to Runtime.
func ParseMessage(name string, raw []byte) (any, error) {
	if err := ValidateStructure(name, raw); err != nil {
		return nil, err
	}
	canonical, err := jcs.Transform(raw)
	if err != nil {
		return nil, err
	}
	raw = canonical
	switch name {
	case "HelloRequest":
		var message HelloRequest
		err := json.Unmarshal(raw, &message)
		return message, err
	case "HelloResponse":
		var message HelloResponse
		if err := json.Unmarshal(raw, &message); err != nil {
			return nil, err
		}
		if _, err := utcInstant(message.ServerTime); err != nil {
			return nil, err
		}
		return message, validatePolicy(message.Policy)
	case "Snapshot":
		var message Snapshot
		if err := json.Unmarshal(raw, &message); err != nil {
			return nil, err
		}
		return message, validateSnapshot(message, raw)
	case "ReportRequest":
		var message ReportRequest
		if err := json.Unmarshal(raw, &message); err != nil {
			return nil, err
		}
		return message, validateReport(message)
	case "ReportAck":
		var message ReportAck
		err := json.Unmarshal(raw, &message)
		return message, err
	case "ErrorResponse":
		var message ErrorResponse
		err := json.Unmarshal(raw, &message)
		return message, err
	}
	return nil, fmt.Errorf("INVALID_CONFIG: Unknown message type")
}

// MessageNames returns only the supported direct contract entry points.
func MessageNames() []string {
	names := []string{"HelloRequest", "HelloResponse", "Snapshot", "ReportRequest", "ReportAck", "ErrorResponse"}
	sort.Strings(names)
	return names
}
