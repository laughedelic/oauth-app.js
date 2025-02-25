import { createServer } from "http";
import { URL } from "url";

import fetch from "node-fetch";
import { OAuthApp, createNodeMiddleware } from "../src/";

describe("createNodeMiddleware(app)", () => {
  it("GET /api/github/oauth/login", async () => {
    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
    });

    const server = createServer(createNodeMiddleware(app)).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const { status, headers } = await fetch(
      `http://localhost:${port}/api/github/oauth/login`,
      {
        redirect: "manual",
      }
    );

    server.close();

    expect(status).toEqual(302);

    const url = new URL(headers.get("location") as string);

    expect(url).toMatchObject({
      origin: "https://github.com",
      pathname: "/login/oauth/authorize",
    });
    expect(url.searchParams.get("client_id")).toEqual("0123");
    expect(url.searchParams.get("state")).toMatch(/^\w+$/);
    expect(url.searchParams.get("scope")).toEqual(null);
  });

  it("GET /api/github/oauth/login with defaultScopes (#110)", async () => {
    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
      defaultScopes: ["repo"],
    });

    const server = createServer(createNodeMiddleware(app)).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const { status, headers } = await fetch(
      `http://localhost:${port}/api/github/oauth/login`,
      {
        redirect: "manual",
      }
    );

    server.close();

    expect(status).toEqual(302);

    const url = new URL(headers.get("location") as string);
    expect(url).toMatchObject({
      origin: "https://github.com",
      pathname: "/login/oauth/authorize",
    });
    expect(url.searchParams.get("client_id")).toEqual("0123");
    expect(url.searchParams.get("state")).toMatch(/^\w+$/);
    expect(url.searchParams.get("scope")).toEqual("repo");
  });

  it("GET /api/github/oauth/login?state=mystate123&scopes=one,two,three", async () => {
    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
    });

    const server = createServer(createNodeMiddleware(app)).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const { status, headers } = await fetch(
      `http://localhost:${port}/api/github/oauth/login?state=mystate123&scopes=one,two,three`,
      {
        redirect: "manual",
      }
    );

    server.close();

    expect(status).toEqual(302);

    const url = new URL(headers.get("location") as string);
    expect(url).toMatchObject({
      origin: "https://github.com",
      pathname: "/login/oauth/authorize",
    });

    expect(url.searchParams.get("client_id")).toEqual("0123");
    expect(url.searchParams.get("state")).toEqual("mystate123");
    expect(url.searchParams.get("scope")).toEqual("one,two,three");
  });

  it("GET /api/github/oauth/callback?code=012345&state=mystate123", async () => {
    const appMock = {
      createToken: jest
        .fn()
        .mockResolvedValue({ authentication: { token: "token123" } }),
    };

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/callback?code=012345&state=state123`
    );

    server.close();

    expect(response.status).toEqual(200);
    expect(await response.text()).toMatch(/token123/);

    expect(appMock.createToken.mock.calls.length).toEqual(1);
    expect(appMock.createToken.mock.calls[0][0]).toStrictEqual({
      state: "state123",
      code: "012345",
    });
  });

  it("POST /api/github/oauth/token", async () => {
    const appMock = {
      createToken: jest.fn().mockResolvedValue({
        authentication: {
          token: "token123",
          scopes: ["repo", "gist"],
        },
      }),
    };

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "POST",
        body: JSON.stringify({
          code: "012345",
          state: "state123",
          redirectUrl: "http://example.com",
        }),
      }
    );

    server.close();

    expect(response.status).toEqual(201);
    expect(await response.json()).toStrictEqual({
      token: "token123",
      scopes: ["repo", "gist"],
    });

    expect(appMock.createToken.mock.calls.length).toEqual(1);
    expect(appMock.createToken.mock.calls[0][0]).toStrictEqual({
      state: "state123",
      code: "012345",
      redirectUrl: "http://example.com",
    });
  });

  it("GET /api/github/oauth/token", async () => {
    const appMock = {
      checkToken: jest.fn().mockResolvedValue({ id: 1 }),
    };

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        headers: {
          authorization: "token token123",
        },
      }
    );

    server.close();

    expect(response.status).toEqual(200);
    expect(await response.json()).toStrictEqual({ id: 1 });

    expect(appMock.checkToken.mock.calls.length).toEqual(1);
    expect(appMock.checkToken.mock.calls[0][0]).toStrictEqual({
      token: "token123",
    });
  });

  it("PATCH /api/github/oauth/token", async () => {
    const appMock = {
      resetToken: jest.fn().mockResolvedValue({
        id: 2,
        token: "token456",
        scopes: ["repo", "gist"],
      }),
    };

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "PATCH",
        headers: {
          authorization: "token token123",
        },
      }
    );

    server.close();

    expect(response.status).toEqual(200);
    expect(await response.json()).toStrictEqual({
      id: 2,
      token: "token456",
      scopes: ["repo", "gist"],
    });

    expect(appMock.resetToken.mock.calls.length).toEqual(1);
    expect(appMock.resetToken.mock.calls[0][0]).toStrictEqual({
      token: "token123",
    });
  });

  it("POST /api/github/oauth/token/scoped", async () => {
    const appMock = {
      scopeToken: jest.fn().mockResolvedValue({
        data: {
          id: 1,
        },
        authentication: {
          token: "scopedtoken456",
        },
      }),
    };

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token/scoped`,
      {
        method: "POST",
        headers: {
          authorization: "token token123",
        },
        body: JSON.stringify({
          target: "octokit",
          repositories: ["oauth-methods.js"],
          permissions: { issues: "write" },
        }),
      }
    );

    server.close();

    expect(response.status).toEqual(200);
    expect(await response.json()).toMatchInlineSnapshot(`
      Object {
        "authentication": Object {
          "token": "scopedtoken456",
        },
        "data": Object {
          "id": 1,
        },
      }
    `);

    expect(appMock.scopeToken.mock.calls.length).toEqual(1);
    expect(appMock.scopeToken.mock.calls[0][0]).toMatchInlineSnapshot(`
      Object {
        "permissions": Object {
          "issues": "write",
        },
        "repositories": Array [
          "oauth-methods.js",
        ],
        "target": "octokit",
        "token": "token123",
      }
    `);
  });

  it("PATCH /api/github/oauth/refresh-token", async () => {
    const appMock = {
      refreshToken: jest.fn().mockResolvedValue({
        ok: true,
      }),
    };

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/refresh-token`,
      {
        method: "PATCH",
        headers: {
          authorization: "token token123",
        },
        body: JSON.stringify({
          refreshToken: "r1.refreshtoken123",
        }),
      }
    );

    server.close();

    expect(await response.json()).toStrictEqual({
      ok: true,
    });
    expect(response.status).toEqual(200);

    expect(appMock.refreshToken.mock.calls.length).toEqual(1);
    expect(appMock.refreshToken.mock.calls[0][0]).toStrictEqual({
      refreshToken: "r1.refreshtoken123",
    });
  });
  it("PATCH /api/github/oauth/token", async () => {
    const appMock = {
      resetToken: jest.fn().mockResolvedValue({
        id: 2,
        token: "token456",
        scopes: ["repo", "gist"],
      }),
    };

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "PATCH",
        headers: {
          authorization: "token token123",
        },
      }
    );

    server.close();

    expect(response.status).toEqual(200);
    expect(await response.json()).toStrictEqual({
      id: 2,
      token: "token456",
      scopes: ["repo", "gist"],
    });

    expect(appMock.resetToken.mock.calls.length).toEqual(1);
    expect(appMock.resetToken.mock.calls[0][0]).toStrictEqual({
      token: "token123",
    });
  });

  it("DELETE /api/github/oauth/token", async () => {
    const appMock = {
      deleteToken: jest.fn().mockResolvedValue(undefined),
    };

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "DELETE",
        headers: {
          authorization: "token token123",
        },
      }
    );

    server.close();

    expect(response.status).toEqual(204);

    expect(appMock.deleteToken.mock.calls.length).toEqual(1);
    expect(appMock.deleteToken.mock.calls[0][0]).toStrictEqual({
      token: "token123",
    });
  });

  it("DELETE /api/github/oauth/grant", async () => {
    const appMock = {
      deleteAuthorization: jest.fn().mockResolvedValue(undefined),
    };

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/grant`,
      {
        method: "DELETE",
        headers: {
          authorization: "token token123",
        },
      }
    );

    server.close();

    expect(response.status).toEqual(204);

    expect(appMock.deleteAuthorization.mock.calls.length).toEqual(1);
    expect(appMock.deleteAuthorization.mock.calls[0][0]).toStrictEqual({
      token: "token123",
    });
  });

  it("POST /unrelated", async () => {
    expect.assertions(4);

    const app = new OAuthApp({
      clientId: "0123",
      clientSecret: "0123secret",
    });

    const server = createServer(
      createNodeMiddleware(app, {
        onUnhandledRequest: (request, response) => {
          expect(request.method).toEqual("POST");
          expect(request.url).toEqual("/unrelated");

          // test that the request has not yet been consumed with .on("data")
          expect(request.complete).toEqual(false);

          response.writeHead(200);
          response.end();
        },
      })
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const { status, headers } = await fetch(
      `http://localhost:${port}/unrelated`,
      {
        method: "POST",
        body: JSON.stringify({ ok: true }),
        headers: {
          "content-type": "application/json",
        },
      }
    );

    server.close();

    expect(status).toEqual(200);
  });

  // errors

  it("GET /unknown", async () => {
    const appMock = {};

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(`http://localhost:${port}/unknown`);

    server.close();

    expect(response.status).toEqual(404);
  });

  it("GET /api/github/oauth/callback without code or state", async () => {
    const appMock = {};

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/callback`
    );

    server.close();

    expect(response.status).toEqual(400);
    expect(await response.json()).toStrictEqual({
      error:
        '[@octokit/oauth-app] Both "code" & "state" parameters are required',
    });
  });

  it("GET /api/github/oauth/callback with error", async () => {
    const appMock = {};

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/callback?error=redirect_uri_mismatch&error_description=The+redirect_uri+MUST+match+the+registered+callback+URL+for+this+application.&error_uri=https://docs.github.com/en/developers/apps/troubleshooting-authorization-request-errors/%23redirect-uri-mismatch&state=xyz`
    );

    server.close();

    expect(response.status).toEqual(400);
    expect(await response.json()).toStrictEqual({
      error:
        "[@octokit/oauth-app] redirect_uri_mismatch The redirect_uri MUST match the registered callback URL for this application.",
    });
  });

  it("POST /api/github/oauth/token without state or code", async () => {
    const appMock = {};

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "POST",
        body: JSON.stringify({}),
      }
    );

    server.close();

    expect(response.status).toEqual(400);
    expect(await response.json()).toStrictEqual({
      error:
        '[@octokit/oauth-app] Both "code" & "state" parameters are required',
    });
  });

  it("POST /api/github/oauth/token with non-JSON request body", async () => {
    const appMock = {};

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "POST",
        body: "foo",
      }
    );

    server.close();

    expect(response.status).toEqual(400);
    expect(await response.json()).toStrictEqual({
      error: "[@octokit/oauth-app] request error",
    });
  });

  it("GET /api/github/oauth/token without Authorization header", async () => {
    const appMock = {};

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        headers: {},
      }
    );

    server.close();

    expect(response.status).toEqual(400);
    expect(await response.json()).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  it("PATCH /api/github/oauth/token without authorization header", async () => {
    const appMock = {};

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "PATCH",
        headers: {},
      }
    );

    server.close();

    expect(response.status).toEqual(400);
    expect(await response.json()).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  it("POST /api/github/oauth/token/scoped without authorization header", async () => {
    const appMock = {};

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token/scoped`,
      {
        method: "POST",
        headers: {},
      }
    );

    server.close();

    expect(response.status).toEqual(400);
    expect(await response.json()).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  it("PATCH /api/github/oauth/refresh-token without authorization header", async () => {
    const appMock = {
      refreshToken: jest.fn().mockResolvedValue({
        ok: true,
      }),
    };

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/refresh-token`,
      {
        method: "PATCH",
        body: JSON.stringify({
          refreshToken: "r1.refreshtoken123",
        }),
      }
    );

    server.close();

    expect(response.status).toEqual(400);
    expect(await response.json()).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  it("PATCH /api/github/oauth/refresh-token without refreshToken", async () => {
    const appMock = {
      refreshToken: jest.fn().mockResolvedValue({
        ok: true,
      }),
    };

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/refresh-token`,
      {
        method: "PATCH",
        headers: {
          authorization: "token token123",
        },
      }
    );

    server.close();

    expect(response.status).toEqual(400);
    expect(await response.json()).toStrictEqual({
      error: "[@octokit/oauth-app] refreshToken must be sent in request body",
    });
  });

  it("DELETE /api/github/oauth/token without authorization header", async () => {
    const appMock = {};

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/token`,
      {
        method: "DELETE",
        headers: {},
      }
    );

    server.close();

    expect(response.status).toEqual(400);
    expect(await response.json()).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });

  it("DELETE /api/github/oauth/grant without authorization header", async () => {
    const appMock = {};

    const server = createServer(
      createNodeMiddleware((appMock as unknown) as OAuthApp)
    ).listen();
    // @ts-expect-error complains about { port } although it's included in returned AddressInfo interface
    const { port } = server.address();

    const response = await fetch(
      `http://localhost:${port}/api/github/oauth/grant`,
      {
        method: "DELETE",
        headers: {},
      }
    );

    server.close();

    expect(response.status).toEqual(400);
    expect(await response.json()).toStrictEqual({
      error: '[@octokit/oauth-app] "Authorization" header is required',
    });
  });
});
