
export interface Topic {
    id: string;
    title: string;
    notes: string;
    syntax: string;
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
                        title: 'Declaring Variables',
                        notes: `
                            <p>In JavaScript, variables are used to store data values. Before you use a variable, you need to declare it.</p>
                            <p>JavaScript provides three keywords for declaring variables:</p>
                            <ul>
                                <li><strong>var:</strong> The oldest keyword. It has function scope and can be re-declared and updated. Its usage is generally discouraged in modern JavaScript.</li>
                                <li><strong>let:</strong> Introduced in ES6 (2015). It has block scope, cannot be re-declared within the same scope, but can be updated.</li>
                                <li><strong>const:</strong> Also introduced in ES6. It has block scope, cannot be re-declared or updated. It must be initialized at the time of declaration.</li>
                            </ul>
                            <p>Block scope means the variable is only accessible within the block of code (e.g., inside an <code>if</code> statement or a <code>for</code> loop) where it is defined.</p>
                        `,
                        syntax: `
// Using let (preferred for variables that will change)
let age = 30;
age = 31; // This is allowed
console.log('Age:', age);

// Using const (preferred for constants)
const name = 'Alice';
// name = 'Bob'; // This would cause an error
console.log('Name:', name);

// Block Scope Example
if (true) {
  let blockScopedVar = 'I am inside the block';
  console.log(blockScopedVar);
}
// console.log(blockScopedVar); // This would cause a ReferenceError
`
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
                        notes: `
                            <p>Functions are one of the fundamental building blocks in JavaScript. A function is a reusable set of statements that performs a task or calculates a value.</p>
                            <p>There are several ways to define a function:</p>
                            <ul>
                                <li><strong>Function Declaration:</strong> The most common way. These are hoisted, meaning they can be called before they are defined in the code.</li>
                                <li><strong>Function Expression:</strong> A function can be defined and assigned to a variable. These are not hoisted.</li>
                                <li><strong>Arrow Function:</strong> A more concise syntax for writing function expressions, introduced in ES6. They are anonymous and have a different behavior for the <code>this</code> keyword.</li>
                            </ul>
                        `,
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
`
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
