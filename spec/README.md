# breeze-client tests

These tests were rewritten using Jest.  See the [Jest Getting Started](https://jestjs.io/docs/getting-started) guide and [Jest Troubleshooting](https://jestjs.io/docs/troubleshooting) for more info.

## Running the tests

Run using `npm test` to run all the tests.

Run using `npm test -- query-basic.spec.ts` to run just the tests in query-basic.spec.ts.  Use a similar pattern for other files.

Edit a spec file and replace `test("test name"...)` with `test.only("test name"...)` to run a single test.

### The server

Most of these tests require a server that implements the NorthwindIB persistence layer and responds to the query and save requests.

Generally we use a .NET server from the [breeze.server.net](https://github.com/Breeze/breeze.server.net/) repo, such as **Test.AspNetCore8.EFCore8.sln** in [Test.AspNetCore.EFCore](https://github.com/Breeze/breeze.server.net/tree/master/Tests/Test.AspNetCore.EFCore)

One can also use the [BreezeExpressDemo](https://github.com/Breeze/breeze.server.node/tree/master/breeze-sequelize/test/BreezeExpressDemo) server from [breeze-sequelize](https://github.com/Breeze/breeze.server.node/tree/master/breeze-sequelize).

## Debugging the tests

### In Chrome

See [Jest Troubleshooting](https://jestjs.io/docs/troubleshooting) for info on debugging in Chrome.

### From VSCode

Add the following run configuration:
```
    {
      "name": "Debug Jest Tests",
      "runtimeExecutable": "{your path to node}/node.exe",
      "type": "node",
      "request": "launch",
      "runtimeArgs": [
        "--inspect-brk",
        "${workspaceRoot}/spec/node_modules/jest/bin/jest.js",
        "--runInBand"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen",
      "cwd": "${workspaceRoot}/spec"
    }    
```
Then you can set breakpoints in VSCode.

Note that the tests run the breeze code installed in `/node_modules/breeze-client`, so you'll need to set the breakpoints in 
`spec\node_modules\breeze-client\bundles\breeze-client.umd.js`, not in the source code.

## Old BreezeJs tests not migrated 

See information about the legacy breeze tests in [BUILD.md](../BUILD.md).

Note that the following test suites were NOT migrated from old BreezeJs - we may consider moving them at some later time.

- AjaxAdapterTests - mostly tested old adapters
- RawODataTests - tests using old ODATA query syntax
- QueryNonEFTests - querying against a non database backend
- SaveTransactionTests - specific tests using different .NET Transaction models
- ClassRewriteTests - tests involving legacy pre ES5 constructs
- TPT and TPH inheritence tests
- KO and Mongo specific tests


