package agentcli

import "flag"

// Options is the parsed native command format, before mode and path decisions.
type Options struct {
	URL, NodeID, CA, Directory, JournalKey                                                  string
	Enroll, Rotate, Relay, Multihop                                                         bool
	ProbeRegistration, ProbeExecution, ProbeIngress, ProbeServices, ProbeEcho               bool
	ImportTransitJournal, TimeProof, TimeProofKey                                           string
	Diagnostics, Telemetry, ForwardTelemetry, HostTelemetry, ProbeTelemetry, InspectJournal bool
}

func ParseOptions() Options {
	url := flag.String("control", "", "Trusted HTTPS Control URL")
	node := flag.String("node", "", "Node ID")
	ca := flag.String("ca", "", "Trusted Control CA")
	directory := flag.String("state", "", "Protected Agent state directory")
	journalKey := flag.String("journal-key", "", "Protected journal MAC key path, outside state directory")
	enroll := flag.Bool("enroll", false, "Exchange TUNEX_ENROLLMENT_TOKEN, then initialize state")
	rotate := flag.Bool("rotate", false, "Rotate Node key/certificate after online Hello without resetting execution state")
	relayEnabled := flag.Bool("relay", false, "Enable authenticated Relay execution with a dedicated Node peer credential")
	probeRegistration := flag.Bool("probe-registration", false, "Maintain experimental Probe instance registration")
	probeExecution := flag.Bool("probe-execution", false, "Opt in to bounded connect-only Probe tasks; requires --probe-registration")
	probeIngress := flag.Bool("probe-ingress", false, "Opt in to local current Direct TCP ingress connect; requires --probe-registration and --probe-execution; may trigger the original listener's downstream dial")
	probeServices := flag.Bool("probe-services", false, "Opt in to exact pinned observation TLS handshake through current Direct ingress; requires --probe-ingress, --probe-execution and --probe-registration; TLS records count as real Forward payload")
	probeEcho := flag.Bool("probe-echo", false, "Opt in to controlled TCP/UDP nonce echo through current Direct ingress; requires services, ingress, execution and registration; real payload and original UDP association idle lifetime apply")
	multihopEnabled := flag.Bool("multihop", false, "Opt in to execution extension 1 and upgrade the protected journal; requires --relay")
	importTransit := flag.String("import-transit-journal", "", "Explicit legacy offline Transit journal to import as retired high-water; requires --multihop")
	timeProof := flag.String("time-proof", "", "Optional supervisor OS synchronization proof")
	timeProofKey := flag.String("time-proof-key", "", "Protected MAC key for the supervisor proof")
	diagnostics := flag.Bool("diagnostics", false, "Write protected local resource samples for operator measurements")
	telemetry := flag.Bool("telemetry", false, "Opt in to bounded process and runtime telemetry; not payload usage or execution authority")
	forwardTelemetry := flag.Bool("forward-telemetry", false, "Opt in to bounded ingress operational payload counters; not billing or execution authority")
	hostTelemetry := flag.Bool("host-telemetry", false, "Opt in to bounded Agent-visible OS resources; not cgroup limits or physical-host guarantees")
	probeTelemetry := flag.Bool("probe-telemetry", false, "Opt in to cumulative actual Probe dial counters; does not enable Probe execution")
	inspectJournal := flag.Bool("inspect-journal", false, "Read-only authenticated journal summary; requires node, state and journal-key, no Control connection")
	flag.Parse()
	return Options{URL: *url, NodeID: *node, CA: *ca, Directory: *directory, JournalKey: *journalKey,
		Enroll: *enroll, Rotate: *rotate, Relay: *relayEnabled, Multihop: *multihopEnabled,
		ProbeRegistration: *probeRegistration, ProbeExecution: *probeExecution, ProbeIngress: *probeIngress,
		ProbeServices: *probeServices, ProbeEcho: *probeEcho, ImportTransitJournal: *importTransit,
		TimeProof: *timeProof, TimeProofKey: *timeProofKey, Diagnostics: *diagnostics, Telemetry: *telemetry,
		ForwardTelemetry: *forwardTelemetry, HostTelemetry: *hostTelemetry, ProbeTelemetry: *probeTelemetry,
		InspectJournal: *inspectJournal}
}
