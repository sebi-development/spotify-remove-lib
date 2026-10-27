export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export class JobAlreadyRunningError extends Error {
  constructor() {
    super('A job is already running');
  }
}
