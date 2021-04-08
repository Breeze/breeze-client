# Breeze 2.0
Built using TypeScript 3.x.

## Release Notes

With release 2.0, the deployment of Breeze has changed significantly, but the API has not.

See <a href="http://breeze.github.io/doc-js/release-notes.html" target="_blank">the release notes on breeze.github.io</a>.

## Introduction

If this is your first time browsing the API, you might want to start with the <a href="/doc-js/api-docs/classes/entitymanager.html">EntityManager</a> as this is the core class in Breeze.

<a href="http://breeze.github.io/doc-samples/">Sample applications</a>, <a href="http://www.youtube.com/playlist?list=PL88C2B43249433416&feature=plcp" target="_blank">videos</a>, and <a href="http://breeze.github.io/doc-js">additional documentation</a> are also available.

### What is public and what is not

You can develop your application with the confidence that the Breeze APIs you call are stable.  We've developed Breeze 2.0 using [TypeScript](http://typescriptlang.org) to make sure that it is internally consistent and correctly documented.

Of course Breeze must continue to evolve. We pledge to be careful as it evolves, strive to preserve backward compatibility, make as few breaking changes as necessary, and alert you when we do.

But we need your understanding too. We can only be accountable for the public API and the behaviors we say we support <i>in this API documentation</i>. We cannot be responsible for application code that relies on undocumented features, types, properties or implementation details.

Any type or type member that is not documented here <i>may change at any time without notice</i>. Assume it will change if it is marked "beta" or "experimental". Almost every identifier that begins with an underscore (_) is off-limits.

JavaScript doesn't hide its secrets very well. We all cheat from time to time and reference something we shouldn't. We all peek under the covers and then assume that the library will continue to work that way in the future. That's cool. We get it. All we ask is that you take responsibility for your actions.
