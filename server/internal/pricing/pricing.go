package pricing

import (
	"log/slog"
	"strings"
)

// ModelPricing defines cost per 1M tokens in USD.
type ModelPricing struct {
	InputPerMillion      float64
	OutputPerMillion     float64
	CacheReadPerMillion  float64
	CacheWritePerMillion float64
}

// PricingTable maps model names to their pricing.
// Costs in USD per 1M tokens.
var PricingTable = map[string]ModelPricing{
	// Anthropic
	"claude-opus-4-5":                {InputPerMillion: 15.0, OutputPerMillion: 75.0, CacheReadPerMillion: 1.5, CacheWritePerMillion: 18.75},
	"claude-opus-4-6":                {InputPerMillion: 15.0, OutputPerMillion: 75.0, CacheReadPerMillion: 1.5, CacheWritePerMillion: 18.75},
	"claude-sonnet-4-5":              {InputPerMillion: 3.0, OutputPerMillion: 15.0, CacheReadPerMillion: 0.3, CacheWritePerMillion: 3.75},
	"claude-sonnet-4-6":              {InputPerMillion: 3.0, OutputPerMillion: 15.0, CacheReadPerMillion: 0.3, CacheWritePerMillion: 3.75},
	"claude-haiku-4-5":               {InputPerMillion: 0.8, OutputPerMillion: 4.0, CacheReadPerMillion: 0.08, CacheWritePerMillion: 1.0},
	"claude-3-5-sonnet-20241022":     {InputPerMillion: 3.0, OutputPerMillion: 15.0, CacheReadPerMillion: 0.3, CacheWritePerMillion: 3.75},
	// GLM
	"glm-5.1":                        {InputPerMillion: 0.1, OutputPerMillion: 0.3},
	// Grok
	"grok-4-fast":                    {InputPerMillion: 0.5, OutputPerMillion: 1.5},
	"grok-4":                         {InputPerMillion: 3.0, OutputPerMillion: 15.0},
	// OpenAI (for reference)
	"gpt-4o":                         {InputPerMillion: 2.5, OutputPerMillion: 10.0},
	"gpt-4o-mini":                    {InputPerMillion: 0.15, OutputPerMillion: 0.6},
}

// CalculateCost returns estimated cost in USD.
func CalculateCost(model string, inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens int64) float64 {
	pricing, ok := PricingTable[model]
	if !ok {
		// Try prefix matching for versioned models
		for key, p := range PricingTable {
			if strings.HasPrefix(model, key) {
				pricing = p
				ok = true
				break
			}
		}
	}
	if !ok {
		slog.Warn("unknown model for pricing, using 0 cost", "model", model)
		return 0
	}

	cost := (float64(inputTokens) / 1_000_000.0) * pricing.InputPerMillion
	cost += (float64(outputTokens) / 1_000_000.0) * pricing.OutputPerMillion
	cost += (float64(cacheReadTokens) / 1_000_000.0) * pricing.CacheReadPerMillion
	cost += (float64(cacheWriteTokens) / 1_000_000.0) * pricing.CacheWritePerMillion

	return cost
}
