export type IO = {
  confirm(message: string): Promise<boolean>;
  logSuccess(message: string): void;
  logError(message: string): void;
  logInfo(message: string): void;
  log(message: string): void;
};

export class ConsoleIO implements IO {
  async confirm(message: string): Promise<boolean> {
    console.log(`\n${message} (y/N)`);

    for await (const line of console) {
      const answer = line.toString().trim().toLowerCase();
      if (answer === 'y' || answer === 'yes') {
        return true;
      }
      if (answer === 'n' || answer === 'no' || answer === '') {
        return false;
      }
      console.log('Please answer y or n:');
    }

    return false;
  }

  logSuccess(message: string): void {
    console.log(`✓ ${message}`);
  }

  logError(message: string): void {
    console.error(`✗ ${message}`);
  }

  logInfo(message: string): void {
    console.log(`ℹ ${message}`);
  }

  log(message: string): void {
    console.log(message);
  }
}

export class MockIO implements IO {
  public confirmResponses: boolean[] = [];
  public logs: Array<{ type: string; message: string }> = [];
  private confirmIndex = 0;

  async confirm(message: string): Promise<boolean> {
    this.logs.push({ type: 'confirm', message });
    const response = this.confirmResponses[this.confirmIndex] ?? false;
    this.confirmIndex++;
    return response;
  }

  logSuccess(message: string): void {
    this.logs.push({ type: 'success', message });
  }

  logError(message: string): void {
    this.logs.push({ type: 'error', message });
  }

  logInfo(message: string): void {
    this.logs.push({ type: 'info', message });
  }

  log(message: string): void {
    this.logs.push({ type: 'log', message });
  }

  reset(): void {
    this.logs = [];
    this.confirmIndex = 0;
    this.confirmResponses = [];
  }
}

export const defaultIO = new ConsoleIO();
