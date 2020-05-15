
export namespace GridError {
  export const SideCountTooLowError = customError("SizeSizeTooLowError", "Side Size too low");
}

export function customError(name: string, message: string) {
  class ExtendableError {
    name: string;
    message: string;
    stack: string | undefined;

    constructor(message: string) {
      this.name = 'ExtendableError';
      this.message = message;
      this.stack = new Error().stack;
    }
  }

  // Dont use extends, manually patch the prototype to
  // enable x instanceof xxError checks
  // ExtendableError.prototype = Object.create(Error.prototype);

  return class extends ExtendableError {
    constructor() {
      super(message);
      this.name = name;
    }
  };
}