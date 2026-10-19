package control

import "testing"

func TestExplicitProviderConstructorsRejectMissingBeforeBootstrap(t *testing.T) {
	invalidOptions := Options{}
	for _, missing := range []string{"identity", "channel"} {
		providers := defaultProviders()
		if missing == "identity" {
			providers.Identity = nil
		} else {
			providers.Channel = nil
		}
		runner, err := NewWithProviders(invalidOptions, providers)
		if runner != nil || err == nil || err.Error() != "INVALID_CONFIG: Agent identity and channel providers required" {
			t.Fatalf("missing %s fell through to configuration/bootstrap: runner=%v err=%v", missing, runner, err)
		}
	}
	for _, missing := range []string{"identity", "channel", "bootstrap", "schedule", "auxiliary", "observation", "entropy", "measurements", "log"} {
		providers, effects, local := defaultProviders(), defaultEffects(), defaultLocalServices()
		switch missing {
		case "identity":
			providers.Identity = nil
		case "channel":
			providers.Channel = nil
		case "bootstrap":
			effects.Bootstrap = nil
		case "schedule":
			effects.Schedule = nil
		case "auxiliary":
			effects.Auxiliary = nil
		case "observation":
			local.Observation = nil
		case "entropy":
			local.Entropy = nil
		case "measurements":
			local.Measurements = nil
		case "log":
			local.Log = nil
		}
		runner, err := NewWithLocalServices(invalidOptions, providers, effects, local)
		if runner != nil || err == nil || err.Error() != "INVALID_CONFIG: Agent providers, platform effects and local services required" {
			t.Fatalf("missing %s fell through to configuration/bootstrap: runner=%v err=%v", missing, runner, err)
		}
		if missing == "identity" || missing == "channel" || missing == "bootstrap" || missing == "schedule" || missing == "auxiliary" {
			runner, err = NewWithEffects(invalidOptions, providers, effects)
			if runner != nil || err == nil || err.Error() != "INVALID_CONFIG: Agent providers and platform effects required" {
				t.Fatalf("missing effect %s fell through to bootstrap: runner=%v err=%v", missing, runner, err)
			}
		}
	}
}
