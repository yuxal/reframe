import * as React from "react";

interface HelloProps { compiler: string; framework: string; }

const Hello = (props: HelloProps) => <h1>Hello from {props.compiler} and {props.framework}!</h1>;

export default {
    route: '/',
    view: () => <Hello compiler="TypeScript" framework="React" />,
    domStatic: true,
};
