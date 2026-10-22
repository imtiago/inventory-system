import { z } from "zod";

// z.coerce.date() turns null into 1970-01-01 and "" into an invalid date silently
// in some cases; reject both explicitly.
export const requestDate = z.preprocess(
  (value) => (value === null || value === "" ? "invalid" : value),
  z.coerce.date(),
);
