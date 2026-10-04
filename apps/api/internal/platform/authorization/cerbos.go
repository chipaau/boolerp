package authorization

import (
	"context"
	"crypto/rand"
	"fmt"
	"strings"
	"time"

	"github.com/cerbos/cerbos-sdk-go/cerbos"
	enginev1 "github.com/cerbos/cerbos/api/genpb/cerbos/engine/v1"
	schemav1 "github.com/cerbos/cerbos/api/genpb/cerbos/schema/v1"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"

	"github.com/boolmv/erp/apps/api/internal/platform/kit/requestid"
)

// Client is the part of cerbos-sdk-go's gRPC client the adapter uses (C152);
// *cerbos.GRPCClient implements it, and tests substitute their own.
type Client interface {
	CheckResources(ctx context.Context, p *cerbos.Principal, b *cerbos.ResourceBatch) (*cerbos.CheckResourcesResponse, error)
	PlanResources(ctx context.Context, p *cerbos.Principal, r *cerbos.Resource, actions ...string) (*cerbos.PlanResourcesResponse, error)
}

// Settings configure the connection to Cerbos (from config.Cerbos).
type Settings struct {
	Addr      string        // host:port of Cerbos's gRPC listener, such as cerbos:3593
	TLSCAFile string        // CA certificate for TLS; empty means plaintext (development only)
	Timeout   time.Duration // the longest a check may take; a slower Cerbos means deny
}

// Dial connects to Cerbos over gRPC with the official SDK. telemetry instruments
// the connection (the API's tracing and metrics), so a check appears inside its
// request's trace. It connects lazily: the API starts while Cerbos is down, and
// checks are refused until it is up.
func Dial(s Settings, telemetry ...otelgrpc.Option) (*cerbos.GRPCClient, error) {
	opts := []cerbos.Opt{
		cerbos.WithStatsHandler(otelgrpc.NewClientHandler(telemetry...)),
		cerbos.WithConnectTimeout(s.Timeout),
		cerbos.WithUserAgent("bool-erp-api"),
	}
	if s.TLSCAFile != "" {
		opts = append(opts, cerbos.WithTLSCACert(s.TLSCAFile))
	} else {
		opts = append(opts, cerbos.WithPlaintext())
	}
	c, err := cerbos.New("passthrough:///"+s.Addr, opts...)
	if err != nil {
		return nil, fmt.Errorf("authorization: connecting to Cerbos: %w", err)
	}
	// Decision logs carry our request ID, so they match the request's logs.
	return c.With(cerbos.RequestIDGenerator(requestID)), nil
}

func requestID(ctx context.Context) string {
	if id := requestid.FromContext(ctx); id != "" {
		return id
	}
	return rand.Text() // a CLI command or job: still unique
}

// Cerbos implements Authorizer with Cerbos (C149, C155). Every outcome other than
// "allowed" is an error, so a caller that only proceeds on nil cannot proceed by
// mistake.
type Cerbos struct {
	client    Client
	principal PrincipalFunc
	timeout   time.Duration
}

// NewCerbos returns the authorizer over client; principal builds who is asking
// from each request's context.
func NewCerbos(client Client, principal PrincipalFunc, timeout time.Duration) *Cerbos {
	return &Cerbos{client: client, principal: principal, timeout: timeout}
}

// newRecordID stands in for the ID of a record being created: Cerbos needs one,
// and the policy decides on the attributes.
const newRecordID = "new"

// Check implements Authorizer with one CheckResources call.
func (a *Cerbos) Check(ctx context.Context, action string, r Resource, facts ...Fact) error {
	NoteDecision(ctx)
	p, err := a.principalFor(ctx, facts)
	if err != nil {
		return err
	}
	id := r.ID
	if id == "" {
		id = newRecordID
	}
	res := cerbos.NewResource(r.Kind, id)
	if len(r.Attributes) > 0 {
		res.WithAttributes(r.Attributes)
	}
	ctx, cancel := context.WithTimeout(ctx, a.timeout)
	defer cancel()
	resp, err := a.client.CheckResources(ctx, p, cerbos.NewResourceBatch().Add(res, action))
	if err != nil {
		return fmt.Errorf("%w: %w", ErrUnavailable, err)
	}
	result := resp.GetResource(id, cerbos.MatchResourceKind(r.Kind))
	if err := result.Err(); err != nil {
		return fmt.Errorf("%w: %w", ErrUnavailable, err)
	}
	if errs := result.GetValidationErrors(); len(errs) > 0 {
		return fmt.Errorf("%w: %s %s: %s", ErrInvalid, r.Kind, action, validationMessages(errs))
	}
	// A missing action counts as denied.
	if !result.IsAllowed(action) {
		return ErrDenied
	}
	return nil
}

// Can implements Authorizer with the query planner: allowed when some record of
// the kind may be acted on (the plan is not always denied).
func (a *Cerbos) Can(ctx context.Context, action, kind string, facts ...Fact) error {
	NoteDecision(ctx)
	p, err := a.principalFor(ctx, facts)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, a.timeout)
	defer cancel()
	resp, err := a.client.PlanResources(ctx, p, cerbos.NewResource(kind, ""), action)
	if err != nil {
		return fmt.Errorf("%w: %w", ErrUnavailable, err)
	}
	if errs := resp.GetValidationErrors(); len(errs) > 0 {
		return fmt.Errorf("%w: %s %s: %s", ErrInvalid, kind, action, validationMessages(errs))
	}
	if resp.GetFilter() == nil || resp.GetFilter().GetKind() == enginev1.PlanResourcesFilter_KIND_ALWAYS_DENIED {
		return ErrDenied
	}
	return nil
}

// principalFor builds the principal from ctx, plus the decision's facts. Without
// a caller there is nobody to allow.
func (a *Cerbos) principalFor(ctx context.Context, facts []Fact) (*cerbos.Principal, error) {
	pr, err := a.principal(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrDenied, err)
	}
	if pr.ID == "" || len(pr.Roles) == 0 {
		return nil, fmt.Errorf("%w: no principal", ErrDenied)
	}
	attributes := make(map[string]any, len(pr.Attributes))
	for k, v := range pr.Attributes {
		attributes[k] = v
	}
	for _, f := range facts {
		f(attributes)
	}
	p := cerbos.NewPrincipal(pr.ID, pr.Roles...)
	if len(attributes) > 0 {
		p.WithAttributes(attributes)
	}
	return p, p.Validate()
}

func validationMessages(errs []*schemav1.ValidationError) string {
	msgs := make([]string, len(errs))
	for i, e := range errs {
		msgs[i] = e.GetSource().String() + " " + e.GetPath() + ": " + e.GetMessage()
	}
	return strings.Join(msgs, "; ")
}

var _ Authorizer = (*Cerbos)(nil)
