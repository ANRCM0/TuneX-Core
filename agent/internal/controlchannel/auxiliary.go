package controlchannel

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/tunex/vnext/agent/internal/executionchannel"
)

func message(ctx context.Context, base, path string, raw []byte) (*http.Request, error) {
	return http.NewRequestWithContext(ctx, "POST", strings.TrimRight(base, "/")+path, bytes.NewReader(raw))
}
func headers(request *http.Request, epoch uint64) {
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-TuneX-Session-Epoch", strconv.FormatUint(epoch, 10))
}
func exchange(client *http.Client, request *http.Request) (executionchannel.Reply, error) {
	response, err := client.Do(request)
	if err != nil {
		return executionchannel.Reply{}, err
	}
	return executionchannel.Reply{StatusCode: response.StatusCode, Body: response.Body}, nil
}
func (Native) ProbeInstance(ctx context.Context, client *http.Client, base string, raw []byte, epoch uint64) (executionchannel.Reply, error) {
	request, err := message(ctx, base, "/agent/v3/probe/instance", raw)
	if err != nil {
		return executionchannel.Reply{}, err
	}
	headers(request, epoch)
	return exchange(client, request)
}
func (Native) ProbeClaim(ctx context.Context, client *http.Client, base string, raw []byte, epoch uint64) (executionchannel.Reply, error) {
	request, err := message(ctx, base, "/agent/v3/probe/claim", raw)
	if err != nil {
		return executionchannel.Reply{}, err
	}
	if request.URL.Scheme != "https" || client == nil {
		return executionchannel.Reply{}, executionchannel.ErrForbiddenURL
	}
	headers(request, epoch)
	copy := *client
	copy.CheckRedirect = func(*http.Request, []*http.Request) error { return fmt.Errorf("Probe claim redirects are forbidden") }
	return exchange(&copy, request)
}
func (Native) ProbeDelivery(ctx context.Context, client *http.Client, base, path string, raw []byte, epoch uint64) (executionchannel.Reply, error) {
	request, err := message(ctx, base, path, raw)
	if err != nil {
		return executionchannel.Reply{}, err
	}
	if request.URL.Scheme != "https" || request.URL.Host == "" || request.URL.User != nil || request.URL.RawQuery != "" || request.URL.Fragment != "" || client == nil {
		return executionchannel.Reply{}, executionchannel.ErrForbiddenURL
	}
	headers(request, epoch)
	copy := *client
	copy.CheckRedirect = func(*http.Request, []*http.Request) error {
		return fmt.Errorf("Probe delivery redirects are forbidden")
	}
	return exchange(&copy, request)
}
func (Native) PostTelemetry(ctx context.Context, client *http.Client, base, path string, raw []byte, epoch uint64) (executionchannel.Reply, error) {
	request, err := message(ctx, base, path, raw)
	if err != nil {
		return executionchannel.Reply{}, err
	}
	headers(request, epoch)
	return exchange(client, request)
}
func (Native) CloneTelemetry(client *http.Client, redirectMessage string) (*http.Client, func(), bool) {
	base, ok := client.Transport.(*http.Transport)
	if !ok {
		return nil, nil, false
	}
	transport := base.Clone()
	transport.MaxConnsPerHost = 1
	transport.MaxIdleConns = 1
	transport.MaxIdleConnsPerHost = 1
	transport.ResponseHeaderTimeout = 2 * time.Second
	transport.MaxResponseHeaderBytes = 8192
	copy := &http.Client{Transport: transport, Timeout: 2 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return fmt.Errorf("%s", redirectMessage) }}
	return copy, transport.CloseIdleConnections, true
}
