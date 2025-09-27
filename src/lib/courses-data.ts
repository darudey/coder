
export interface NoteSegment {
    type: 'html' | 'code';
    content: string;
}

export interface PracticeQuestion {
    id: string;
    question: string;
    initialCode: string;
    solutionCode: string;
    expectedOutput: string;
}

export interface Topic {
    id:string;
    title: string;
    notes: NoteSegment[];
    syntax: string;
    practice: PracticeQuestion[];
    videoUrl?: string;
}

export interface Chapter {
    id: string;
    title: string;
    description: string;
    topics: Topic[];
}

export interface Course {
    id: string;
    title: string;
    description: string;
    chapters: Chapter[];
}

export const courses: Course[] = [
    {
        id: 'js-fundamentals',
        title: 'JavaScript Fundamentals',
        description: 'Master the core concepts of JavaScript, from variables to functions and beyond.',
        chapters: [
            {
                id: 'variables-and-data-types',
                title: 'Variables and Data Types',
                description: 'Learn how to store and manage data in JavaScript.',
                topics: [
                    {
                        id: 'declaring-variables',
                        title: 'Variables & Constants in JavaScript',
                        notes: [
                            {
                                type: 'html',
                                content: `
                                    <h4>What is a variable?</h4>
                                    <p>A variable is a container for storing data. Think of it as a box with a name, where you can put a value and use it later.</p>
                                    <p>In JS, you can declare variables with:</p>
                                    <ol>
                                        <li><b>var</b>
                                            <ul>
                                                <li>Old way (before 2015).</li>
                                                <li>Function-scoped, not block-scoped.</li>
                                                <li>Hoisted (accessible before declaration, but gives undefined).</li>
                                                <li>Avoid in modern code.</li>
                                            </ul>
                                        </li>
                                        <li><b>let</b>
                                            <ul>
                                                <li>Introduced in ES6 (2015).</li>
                                                <li>Block-scoped → only exists inside {}.</li>
                                                <li>Value can be reassigned.</li>
                                                <li>Most commonly used.</li>
                                            </ul>
                                        </li>
                                        <li><b>const</b>
                                            <ul>
                                                <li>Block-scoped like let.</li>
                                                <li>Value cannot be reassigned.</li>
                                                <li>Must be initialized at the time of declaration.</li>
                                            </ul>
                                        </li>
                                    </ol>
                                `
                            },
                            {
                                type: 'html',
                                content: `
                                    <hr class="my-4">
                                    <h4>Rules for Naming Variables</h4>
                                    <p><b>Allowed:</b></p>
                                    <ul>
                                        <li>Letters, numbers, _, $</li>
                                        <li>Must not start with a number</li>
                                        <li>Case-sensitive (myName ≠ myname)</li>
                                        <li>Can’t use reserved words (let, class, function, etc.)</li>
                                    </ul>
                                `
                            },
                            {
                                type: 'code',
                                content: `let firstName = "John";  // ✅ camelCase (best practice)
let _id = 101;           // ✅ allowed
let $price = 499;        // ✅ allowed
// let 1student = "Ram";    // ❌ Error: Invalid or unexpected token`
                            },
                            {
                                type: 'html',
                                content: `
                                    <hr class="my-4">
                                    <h4>Best Practices</h4>
                                    <ul>
                                        <li>Use <code>const</code> by default → safer.</li>
                                        <li>Use <code>let</code> when value needs to change.</li>
                                        <li>Avoid <code>var</code>.</li>
                                        <li>Use meaningful names (not x, y, z unless temporary).</li>
                                    </ul>
                                `
                            },
                             {
                                type: 'html',
                                content: `
                                    <hr class="my-4">
                                    <h4>Practice Exercises</h4>
                                    <ol>
                                        <li>Create variables for your name, age, and city. Print them.</li>
                                        <li>Try changing a <code>let</code> variable → works.</li>
                                        <li>Try changing a <code>const</code> variable → see the error.</li>
                                        <li>What happens if you declare <code>var x = 10;</code> inside a block {} and print it outside?</li>
                                        <li><b>Bonus:</b> Test case sensitivity:</li>
                                    </ol>
                                `
                            },
                            {
                                type: 'code',
                                content: `let myName = "A";
let MyName = "B";
console.log(myName, MyName);`
                            }
                        ],
                        syntax: `
// var (not recommended anymore)
var name = "Chandan";
console.log(name); // Chandan

// let
let age = 21;
age = 22; // ✅ reassignment allowed
console.log(age); // 22

// const
const country = "India";
// country = "USA"; // ❌ Error: Assignment to constant variable
console.log(country); // India
`,
                        practice: [
                            {
                                id: 'pq1',
                                question: "Declare three `let` variables for your name, age, and city and print them to the console.",
                                initialCode: `// Declare variables for name, age, and city\n\n\n// Print each variable`,
                                solutionCode: `let name = "Alice";\nlet age = 30;\nlet city = "New York";\nconsole.log("Name: " + name);\nconsole.log("Age: " + age);\nconsole.log("City: " + city);`,
                                expectedOutput: `Name: YOUR_NAME\nAge: YOUR_AGE\nCity: YOUR_CITY`
                            },
                            {
                                id: 'pq2',
                                question: "Declare a `let` variable `score` with a value of 50. Print the initial score. Then, update the score to 75 and print the updated score.",
                                initialCode: `let score = 50;\n\n// Print the initial score\n\n\n// Update the score\n\n\n// Print the updated score`,
                                solutionCode: `let score = 50;\nconsole.log("Initial score:", score);\nscore = 75;\nconsole.log("Updated score:", score);`,
                                expectedOutput: `Initial score: 50\nUpdated score: 75`
                            },
                            {
                                id: 'pq3',
                                question: "Declare a `const` variable `pi` with the value 3.14. Try to reassign it to 3.14159 and observe the error.",
                                initialCode: `const pi = 3.14;\nconsole.log("PI value:", pi);\n\n// Try to reassign pi\npi = 3.14159;\nconsole.log("Updated PI:", pi);`,
                                solutionCode: `const pi = 3.14;\nconsole.log("PI value:", pi);\ntry {\n  pi = 3.14159;\n} catch (e) {\n  console.log(e.name + ': ' + e.message);\n}`,
                                expectedOutput: `TypeError: Assignment to constant variable.`
                            },
                            {
                                id: 'pq4',
                                question: "Declare a `var` variable inside a block scope `{}` and try to access it outside the block. Observe the output.",
                                initialCode: `{\n  var testVar = "I am using var";\n}\n\n// Try to access testVar here`,
                                solutionCode: `{\n  var testVar = "I am using var";\n}\nconsole.log(testVar);`,
                                expectedOutput: `I am using var`
                            },
                            {
                                id: 'pq5',
                                question: "Declare two different variables, `myName` and `MyName`. Assign them different string values and print both to see that they are distinct.",
                                initialCode: `// Declare two case-sensitive variables\n\n\n// Print both variables`,
                                solutionCode: `let myName = "Alice";\nlet MyName = "Bob";\nconsole.log(myName);\nconsole.log(MyName);`,
                                expectedOutput: `Alice\nBob`
                            }
                        ]
                    }
                ]
            },
            {
                id: 'functions',
                title: 'Functions',
                description: 'Understand how to write and use reusable blocks of code.',
                topics: [
                    {
                        id: 'defining-functions',
                        title: 'Defining Functions',
                        notes: [
                           {
                                type: 'html',
                                content: `
                                    <p>Functions are one of the fundamental building blocks in JavaScript. A function is a reusable set of statements that performs a task or calculates a value.</p>
                                    <p>There are several ways to define a function:</p>
                                    <ul>
                                        <li><strong>Function Declaration:</strong> The most common way. These are hoisted, meaning they can be called before they are defined in the code.</li>
                                        <li><strong>Function Expression:</strong> A function can be defined and assigned to a variable. These are not hoisted.</li>
                                        <li><strong>Arrow Function:</strong> A more concise syntax for writing function expressions, introduced in ES6. They are anonymous and have a different behavior for the <code>this</code> keyword.</li>
                                    </ul>
                                `
                           }
                        ],
                        syntax: `
// Function Declaration
function greet(name) {
  return \`Hello, \${name}!\`;
}
console.log(greet('World'));

// Function Expression
const add = function(a, b) {
  return a + b;
};
console.log('Sum:', add(5, 3));

// Arrow Function
const multiply = (a, b) => a * b;
console.log('Product:', multiply(4, 5));
`,
                        practice: []
                    }
                ]
            },
        ],
    },
    {
        id: 'es6-and-beyond',
        title: 'ES6 and Beyond',
        description: 'Explore modern JavaScript features that make your code more powerful and readable.',
        chapters: []
    },
    {
        id: 'dom-manipulation',
        title: 'DOM Manipulation',
        description: 'Learn how to interact with the web page and create dynamic user experiences.',
        chapters: []
    }
];
