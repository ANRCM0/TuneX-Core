package contracts

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

type instant struct {
	seconds  int64
	fraction string
}

var utcPattern = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2})[Tt](\d{2}:\d{2}:\d{2})(?:\.(\d+))?Z$`)

func utcInstant(value string) (instant, error) {
	parts := utcPattern.FindStringSubmatch(value)
	if parts == nil {
		return instant{}, fmt.Errorf("INVALID_CONFIG: Unrepresentable UTC timestamp")
	}
	base, err := time.Parse(time.RFC3339, parts[1]+"T"+parts[2]+"Z")
	if err != nil {
		return instant{}, fmt.Errorf("INVALID_CONFIG: Unrepresentable UTC timestamp")
	}
	return instant{base.Unix(), strings.TrimRight(parts[3], "0")}, nil
}
func compareTimes(left, right string) (int, error) {
	a, err := utcInstant(left)
	if err != nil {
		return 0, err
	}
	b, err := utcInstant(right)
	if err != nil {
		return 0, err
	}
	if a.seconds < b.seconds {
		return -1, nil
	}
	if a.seconds > b.seconds {
		return 1, nil
	}
	length := len(a.fraction)
	if len(b.fraction) > length {
		length = len(b.fraction)
	}
	aText := a.fraction + strings.Repeat("0", length-len(a.fraction))
	bText := b.fraction + strings.Repeat("0", length-len(b.fraction))
	return strings.Compare(aText, bText), nil
}
