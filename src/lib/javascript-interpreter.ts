
import * as esprima from 'esprima-next';

class Interpreter {
  private codeLines: string[];
  private scope: Record<string, any>;
  private heap: Record<string, any>;
  private stack: string[];
  private timeline: any[];
  private step: number;
  private functionDeclarations: Record<string, any>;

  constructor(code: string) {
    this.codeLines = code.split('\n');
    this.scope = {
      console: {
        log: (...args: any[]) => this.logOutput(args),
      },
    };
    this.heap = {};
    this.stack = [];
    this.timeline = [];
    this.step = 0;
    this.functionDeclarations = {};
  }

  private logTimeline(node: any) {
    // Exclude 'console' which has a circular reference back to the interpreter instance
    const { console, ...scopeToSerialize } = this.scope;

    const serializedScope = JSON.parse(JSON.stringify(scopeToSerialize, (key, value) => {
        if (typeof value === 'function') return '[Function]';
        return value;
    }));

    this.timeline.push({
      step: this.step++,
      line: node.loc.start.line - 1,
      variables: { ...serializedScope },
      heap: { ...this.heap },
      stack: [...this.stack],
      output: this.timeline[this.timeline.length - 1]?.output || [],
    });
  }

  private logOutput(args: any[]) {
    const output = args.map(arg => {
        if (typeof arg === 'object' && arg !== null) {
            try {
                return JSON.stringify(arg);
            } catch {
                return '[Circular]';
            }
        }
        return String(arg);
    }).join(' ');

    const lastTimelineState = this.timeline[this.timeline.length - 1];
    if (lastTimelineState) {
        lastTimelineState.output.push(output);
    }
  }

  private evaluate(node: any): any {
    if (!node) return;
    this.logTimeline(node);

    switch (node.type) {
      case 'Program':
        for (const child of node.body) {
          this.evaluate(child);
        }
        break;
      case 'VariableDeclaration':
        for (const declaration of node.declarations) {
          this.evaluate(declaration);
        }
        break;
      case 'VariableDeclarator':
        const value = node.init ? this.evaluate(node.init) : undefined;
        this.scope[(node.id as any).name] = value;
        break;
      case 'ExpressionStatement':
        return this.evaluate(node.expression);
      case 'CallExpression':
        const callee = this.evaluate(node.callee);
        const args = node.arguments.map((arg: any) => this.evaluate(arg));
        
        if (node.callee.type === 'MemberExpression' && typeof callee === 'function') {
            const object = this.evaluate(node.callee.object);
            return callee.apply(object, args);
        }

        if (typeof callee === 'function') {
           return callee(...args);
        }
        
        const funcName = (node.callee as any).name;
        if (this.functionDeclarations[funcName]) {
            this.stack.push(funcName);
            const funcNode = this.functionDeclarations[funcName];
            const originalScope = this.scope;
            
            const localScope: Record<string, any> = { ...this.scope };
            funcNode.params.forEach((param: any, index: number) => {
              localScope[param.name] = args[index];
            });

            this.scope = localScope;
            
            const result = this.evaluate(funcNode.body);

            this.scope = originalScope;
            this.stack.pop();
            return result;
        }
        break;
      case 'ReturnStatement':
         return this.evaluate(node.argument);
      case 'BinaryExpression':
        const left = this.evaluate(node.left);
        const right = this.evaluate(node.right);
        switch (node.operator) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return left / right;
          case '===': return left === right;
          case '!==': return left !== right;
          case '>': return left > right;
          case '<': return left < right;
        }
        break;
      case 'IfStatement':
        if (this.evaluate(node.test)) {
            return this.evaluate(node.consequent);
        } else if (node.alternate) {
            return this.evaluate(node.alternate);
        }
        break;
      case 'BlockStatement':
        let blockResult;
        for (const statement of node.body) {
           blockResult = this.evaluate(statement);
           if (statement.type === 'ReturnStatement') return blockResult;
        }
        return blockResult;
      case 'FunctionDeclaration':
        this.functionDeclarations[node.id.name] = node;
        this.scope[node.id.name] = `[Function: ${node.id.name}]`;
        break;
      case 'Identifier':
        if (node.name in this.scope) {
            return this.scope[node.name];
        }
        throw new Error(`ReferenceError: ${node.name} is not defined`);
      case 'Literal':
        return node.value;
      case 'AssignmentExpression':
        const varName = (node.left as any).name;
        const assignedValue = this.evaluate(node.right);
        this.scope[varName] = assignedValue;
        return assignedValue;
      case 'MemberExpression':
        const object = this.evaluate(node.object);
        const property = (node.property as any).name;
        if(object && typeof object === 'object' && property in object) {
            return object[property];
        }
        return undefined;
      default:
        // console.log('Unsupported node type:', node.type);
        break;
    }
  }

  run() {
    try {
        const ast = esprima.parseScript(this.codeLines.join('\n'), { loc: true });
        this.evaluate(ast);
    } catch(e: any) {
        this.logOutput([`Error: ${e.message}`]);
    }
    return this.timeline;
  }
}

export function generateTimeline(code: string) {
  const interpreter = new Interpreter(code);
  return interpreter.run();
}
