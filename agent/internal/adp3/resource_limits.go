package adp3

import (
	"fmt"
	"strings"
	"time"
)

// Schema validation owns the closed fields. These checks bind the native
// extension to the complete Snapshot and preserve sub-nanosecond ordering.
func compareResourceTime(left, right string) (int, error) {
	a, err := time.Parse(time.RFC3339Nano, left)
	if err != nil {
		return 0, err
	}
	b, err := time.Parse(time.RFC3339Nano, right)
	if err != nil {
		return 0, err
	}
	if a.Unix() < b.Unix() {
		return -1, nil
	}
	if a.Unix() > b.Unix() {
		return 1, nil
	}
	fraction := func(value string) string {
		start := strings.IndexByte(value, '.')
		if start < 0 {
			return ""
		}
		return strings.TrimRight(value[start+1:len(value)-1], "0")
	}
	af, bf := fraction(left), fraction(right)
	length := max(len(af), len(bf))
	return strings.Compare(af+strings.Repeat("0", length-len(af)), bf+strings.Repeat("0", length-len(bf))), nil
}

func validateResourceLimits(snapshot Snapshot) error {
	if snapshot.ResourceLimits == nil {
		return nil
	}
	assignments, referenced, subjects := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, assignment := range snapshot.Assignments {
		assignments[assignment.AssignmentId] = true
	}
	previous := ""
	for _, bucket := range snapshot.ResourceLimits.Buckets {
		for _, value := range []string{bucket.StartsAt, bucket.EndsAt} {
			at, err := time.Parse(time.RFC3339Nano, value)
			if err != nil || at.Format("2006-01-02T15:04:05.000Z") != value {
				return fmt.Errorf("INVALID_CONFIG: Resource period requires canonical millisecond UTC time")
			}
		}
		subject := bucket.ScopeId + "/" + bucket.ActorId + "/" + bucket.NodeId
		window, firstErr := compareResourceTime(bucket.StartsAt, bucket.EndsAt)
		started, secondErr := compareResourceTime(bucket.StartsAt, snapshot.IssuedAt)
		ended, thirdErr := compareResourceTime(snapshot.IssuedAt, bucket.EndsAt)
		if firstErr != nil || secondErr != nil || thirdErr != nil || window >= 0 || started > 0 || ended >= 0 ||
			bucket.NodeId != snapshot.NodeId || bucket.BucketId <= previous || subjects[subject] {
			return fmt.Errorf("INVALID_CONFIG: Resource limit bucket binding, order or period differs")
		}
		previous, subjects[subject] = bucket.BucketId, true
		prior := ""
		for _, assignmentID := range bucket.AssignmentIds {
			if assignmentID <= prior || !assignments[assignmentID] || referenced[assignmentID] {
				return fmt.Errorf("INVALID_CONFIG: Resource limit assignment reference differs")
			}
			prior, referenced[assignmentID] = assignmentID, true
		}
	}
	return nil
}
