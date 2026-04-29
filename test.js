import { readFileSync } from 'fs';

let content = readFileSync('src/App.tsx', 'utf8');

// A very naive script is not enough, as we need the rendered DOM.
// We can use a Node script with jsdom or just run the dev server?
// No, the agent can't hit the dev server with curl if we want rendered react unless it's SSR.
// Wait, we can output `console.log` from a React component.
