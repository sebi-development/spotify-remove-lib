export {};

// Extends Express's own `res.locals` type with what `requireSession` puts there.
// Only true for routes mounted behind that middleware.
declare global {
  namespace Express {
    interface Locals {
      sid: string;
      getToken: () => Promise<string>;
    }
  }
}
