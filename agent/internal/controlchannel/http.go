package controlchannel

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/tunex/vnext/agent/internal/executionchannel"
)

const InterfaceVersion uint64 = 1

type Native struct{}

func (Native) NewClient(roots *x509.CertPool, certificate func() tls.Certificate) *http.Client {
	transport := &http.Transport{TLSClientConfig: &tls.Config{RootCAs: roots, GetClientCertificate: func(*tls.CertificateRequestInfo) (*tls.Certificate, error) {
		value := certificate()
		return &value, nil
	}, MinVersion: tls.VersionTLS13}}
	return &http.Client{Transport: transport, Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return fmt.Errorf("Control redirects are forbidden") }}
}
func (Native) Request(ctx context.Context, client *http.Client, base, method, path string, body []byte, epoch bool, session uint64) ([]byte, error) {
	request, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(base, "/")+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	if epoch {
		request.Header.Set("X-TuneX-Session-Epoch", strconv.FormatUint(session, 10))
	}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(response.Body, 4194305))
	if err != nil {
		return nil, err
	}
	if response.StatusCode != 200 {
		var problem struct {
			Code string `json:"code"`
		}
		json.Unmarshal(raw, &problem)
		return nil, executionchannel.HTTPError{Status: response.StatusCode, Code: problem.Code}
	}
	return raw, nil
}
func (Native) CloseIdleConnections(client *http.Client) { client.CloseIdleConnections() }
