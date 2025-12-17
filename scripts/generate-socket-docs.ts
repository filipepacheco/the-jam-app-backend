#!/usr/bin/env ts-node
/**
 * Socket Events Documentation Generator
 *
 * This script:
 * 1. Reads the AsyncAPI spec (asyncapi.yaml)
 * 2. Extracts event definitions
 * 3. Validates completeness
 * 4. Generates TypeScript types
 * 5. Can generate markdown documentation
 *
 * Usage:
 *   npm run socket-docs:generate
 *   npm run socket-docs:validate
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface AsyncAPISpec {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  channels: Record<string, any>;
  components?: {
    messages?: Record<string, any>;
    schemas?: Record<string, any>;
  };
}

interface EventDocumentation {
  name: string;
  title: string;
  description: string;
  direction: 'client-to-server' | 'server-to-client';
  authentication?: string;
  payload?: any;
  examples?: any[];
}

class SocketEventDocGenerator {
  private spec: AsyncAPISpec;
  private events: EventDocumentation[] = [];
  private specPath: string;

  constructor(specPath: string = './asyncapi.yaml') {
    this.specPath = specPath;
    this.spec = this.loadSpec();
    this.extractEvents();
  }

  /**
   * Load AsyncAPI spec from YAML file
   */
  private loadSpec(): AsyncAPISpec {
    try {
      const content = fs.readFileSync(this.specPath, 'utf-8');
      const spec = yaml.load(content) as AsyncAPISpec;
      console.log('✓ Loaded AsyncAPI spec:', spec.info.title);
      return spec;
    } catch (error) {
      console.error('✗ Failed to load AsyncAPI spec:', error);
      process.exit(1);
    }
  }

  /**
   * Extract all events from spec
   */
  private extractEvents(): void {
    const messages = this.spec.components?.messages || {};

    Object.entries(messages).forEach(([key, message]) => {
      const event: EventDocumentation = {
        name: message.name || key,
        title: message.title || key,
        description: message.description || '',
        direction: this.determineDirection(message.name),
        authentication: message.authentication,
        payload: message.payload,
        examples: message.examples,
      };

      this.events.push(event);
    });

    console.log(`✓ Extracted ${this.events.length} events`);
  }

  /**
   * Determine if event is client→server or server→client
   */
  private determineDirection(
    eventName: string,
  ): 'client-to-server' | 'server-to-client' {
    // Client events typically use imperative/action verbs or end with specific patterns
    const clientPatterns = [
      /^join/,
      /^leave/,
      /^request/,
      /^ready$/,
      /^emit/,
    ];

    const isClient = clientPatterns.some((pattern) =>
      pattern.test(eventName),
    );
    return isClient ? 'client-to-server' : 'server-to-client';
  }

  /**
   * Validate event completeness
   */
  public validate(): boolean {
    console.log('\n📋 Validating events...\n');

    let isValid = true;

    this.events.forEach((event) => {
      const checks = {
        name: !!event.name,
        title: !!event.title,
        description: !!event.description && event.description.length > 10,
        payload: !!event.payload,
      };

      const allPass = Object.values(checks).every((v) => v);

      const icon = allPass ? '✓' : '✗';
      console.log(`${icon} ${event.name}`);

      if (!allPass) {
        Object.entries(checks).forEach(([key, pass]) => {
          if (!pass) {
            console.log(`  - Missing/invalid: ${key}`);
          }
        });
        isValid = false;
      }
    });

    console.log(`\n${isValid ? '✓' : '✗'} Validation ${isValid ? 'passed' : 'failed'}`);
    return isValid;
  }

  /**
   * Generate TypeScript type definitions
   */
  public generateTypeDefinitions(): string {
    const clientEvents = this.events.filter(
      (e) => e.direction === 'client-to-server',
    );
    const serverEvents = this.events.filter(
      (e) => e.direction === 'server-to-client',
    );

    let output = `/**
 * Auto-generated Socket.IO Event Types
 * Generated from: asyncapi.yaml
 * Last Generated: ${new Date().toISOString()}
 * 
 * DO NOT EDIT MANUALLY - Regenerate using:
 * npm run socket-docs:generate
 */\n\n`;

    // Client to Server
    output += `export interface ClientToServerEvents {\n`;
    clientEvents.forEach((event) => {
      output += `  '${event.name}': (data: any) => void; // ${event.title}\n`;
    });
    output += `}\n\n`;

    // Server to Client
    output += `export interface ServerToClientEvents {\n`;
    serverEvents.forEach((event) => {
      output += `  '${event.name}': (data: any) => void; // ${event.title}\n`;
    });
    output += `}\n`;

    return output;
  }

  /**
   * Generate event summary report
   */
  public generateReport(): string {
    const clientEvents = this.events.filter(
      (e) => e.direction === 'client-to-server',
    );
    const serverEvents = this.events.filter(
      (e) => e.direction === 'server-to-client',
    );

    let report = `# Socket Events Documentation Report\n\n`;
    report += `Generated: ${new Date().toISOString()}\n`;
    report += `Spec: ${this.spec.info.title} (v${this.spec.info.version})\n\n`;

    report += `## Summary\n\n`;
    report += `- Total Events: ${this.events.length}\n`;
    report += `- Client → Server: ${clientEvents.length}\n`;
    report += `- Server → Client: ${serverEvents.length}\n\n`;

    report += `## Client → Server Events\n\n`;
    clientEvents.forEach((event) => {
      report += `- \`${event.name}\` - ${event.title}\n`;
    });

    report += `\n## Server → Client Events\n\n`;
    serverEvents.forEach((event) => {
      report += `- \`${event.name}\` - ${event.title}\n`;
    });

    return report;
  }

  /**
   * Generate event checklist for implementation
   */
  public generateChecklist(): string {
    let checklist = `# Socket Events Implementation Checklist\n\n`;
    checklist += `Generated: ${new Date().toISOString()}\n\n`;

    const clientEvents = this.events.filter(
      (e) => e.direction === 'client-to-server',
    );
    const serverEvents = this.events.filter(
      (e) => e.direction === 'server-to-client',
    );

    checklist += `## Frontend - Client → Server Events\n\n`;
    checklist += `Listen for these and emit when needed:\n\n`;
    clientEvents.forEach((event) => {
      checklist += `- [ ] \`${event.name}\` - ${event.title}\n`;
    });

    checklist += `\n## Frontend - Server → Client Events\n\n`;
    checklist += `Listen for and handle these events:\n\n`;
    serverEvents.forEach((event) => {
      checklist += `- [ ] \`${event.name}\` - ${event.title}\n`;
    });

    return checklist;
  }

  /**
   * Save generated content to files
   */
  public saveReports(): void {
    // Save type definitions
    const typesPath = './src/types/socket-events-generated.types.ts';
    fs.writeFileSync(typesPath, this.generateTypeDefinitions());
    console.log(`✓ Generated types: ${typesPath}`);

    // Save report
    const reportPath = './docs/SOCKET_EVENTS_REPORT.md';
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, this.generateReport());
    console.log(`✓ Generated report: ${reportPath}`);

    // Save checklist
    const checklistPath = './docs/SOCKET_IMPLEMENTATION_CHECKLIST.md';
    fs.mkdirSync(path.dirname(checklistPath), { recursive: true });
    fs.writeFileSync(checklistPath, this.generateChecklist());
    console.log(`✓ Generated checklist: ${checklistPath}`);
  }

  /**
   * Print summary to console
   */
  public printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Socket Events Summary');
    console.log('='.repeat(60) + '\n');

    const clientEvents = this.events.filter(
      (e) => e.direction === 'client-to-server',
    );
    const serverEvents = this.events.filter(
      (e) => e.direction === 'server-to-client',
    );

    console.log(`Total Events: ${this.events.length}`);
    console.log(`  ├─ Client → Server: ${clientEvents.length}`);
    console.log(`  └─ Server → Client: ${serverEvents.length}\n`);

    console.log('📤 Client → Server Events:');
    clientEvents.forEach((e) => console.log(`  • ${e.name.padEnd(30)} - ${e.title}`));

    console.log('\n📥 Server → Client Events:');
    serverEvents.forEach((e) => console.log(`  • ${e.name.padEnd(30)} - ${e.title}`));

    console.log('\n' + '='.repeat(60) + '\n');
  }
}

/**
 * Main CLI
 */
async function main() {
  const command = process.argv[2] || 'generate';

  const generator = new SocketEventDocGenerator('./asyncapi.yaml');

  switch (command) {
    case 'validate':
      const isValid = generator.validate();
      process.exit(isValid ? 0 : 1);

    case 'report':
      console.log(generator.generateReport());
      break;

    case 'checklist':
      console.log(generator.generateChecklist());
      break;

    case 'summary':
      generator.printSummary();
      break;

    case 'generate':
    default:
      generator.printSummary();
      generator.validate();
      generator.saveReports();
      break;
  }
}

main().catch(console.error);

