## The serverk lines

Every line that starts with `serverk:` comes from us, not from your bot, and shows what we did before it started:

- `deploying ...`: a new deployment began.
- `fetching ... at ...` or `unpacking snapshot ...`: we pull the commit from your repository, or unpack the version you uploaded.
- `installing dependencies ...`: we install the dependencies.
- `dependencies are up to date`: nothing changed, so we did not reinstall.
- `deployment ... ready at ...`: the deployment succeeded.
- `start command: ...`: the command we run your bot with.
- `bot process starting`: your bot started, and every line after it is printed by your bot itself.

@[open](console)

## When your bot crashes

Errors show up in red. Read the first red line, not the last one:

```txt
TypeError: Cannot read properties of undefined (reading 'send')
    at Client.<anonymous> (/home/container/index.js:12:18)
```

The first line says what went wrong, and the next one says where: the file `index.js`, line 12.

## The usual errors

- `deployment ... failed: sync: ...`: we could not pull the commit. Check that the repository and the branch exist and that the Serverk app on GitHub can reach the repository.
- `deployment ... failed: sync: repository tracks .serverk`: your repository has a `.serverk` folder, and that name is reserved for Serverk. Delete the folder from your repository and redeploy.
- `deployment ... failed: install: ...`: the dependency install failed and the line says why. Usually `package-lock.json` does not match `package.json`, so run `npm install` on your computer and push the new lockfile.
- `deployment ... failed: start: nothing to start`: we found no way to start your bot. Add a `start` script to `package.json`, or set a start command in your bot's settings.
- `TokenInvalid` or `401 Unauthorized`: the token is wrong or changed. Check the variable's name and value, then redeploy.
- `Used disallowed intents`: turn on the intent your bot asks for on the Bot page of the Developer Portal.
- `JavaScript heap out of memory`: your bot ran out of RAM. Move to a bigger plan or keep less in memory.

> [!note] If a deployment fails before your bot starts, we do not retry until you fix the cause. If your bot crashes after it started, we restart it, and after 3 crashes within 10 minutes we stop it so it does not loop. Fix the error and redeploy, or roll back to the last deployment that worked.
