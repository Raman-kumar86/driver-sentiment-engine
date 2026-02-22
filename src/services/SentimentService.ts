import Sentiment from "sentiment";

const analyzer = new Sentiment();

export interface SentimentResult {
  score: number;
  normalizedScore: number;
  label: "positive" | "neutral" | "negative";
  comparative: number;
}

export class SentimentService {
  /**
   * Analyze text and return a normalized 1–5 score.
   * Raw AFINN comparative score clamped to [-3, 3] then mapped linearly to [1, 5].
   */
  analyze(text: string): SentimentResult {
    const result = analyzer.analyze(text);
    const comparative = result.comparative;

    const clamped = Math.max(-3, Math.min(3, comparative));
    const normalizedScore = parseFloat(((clamped + 3) / 6 * 4 + 1).toFixed(2));

    let label: "positive" | "neutral" | "negative";
    if (normalizedScore >= 3.5) label = "positive";
    else if (normalizedScore <= 2.5) label = "negative";
    else label = "neutral";

    return { score: result.score, normalizedScore, label, comparative };
  }
}
