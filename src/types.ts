import { Octokit } from "@octokit/core";
import {
  OAuthAppUserAuthentication,
  GitHubAppUserAuthentication,
  GitHubAppUserAuthenticationWithExpiration,
} from "@octokit/auth-oauth-app";

import { OAuthAppOctokit } from "./oauth-app-octokit";

export type ClientType = "oauth-app" | "github-app";
export type OAuthAppOctokitClassType = typeof OAuthAppOctokit;

export type Scope = string;
export type ClientId = string;
export type ClientSecret = string;
export type Token = string;
export type EventName = "token" | "authorization";
export type ActionName =
  | "created"
  | "reset"
  | "deleted"
  | "refreshed"
  | "scoped";
export type EventAndActionName =
  | "token"
  | "token.created"
  | "token.reset"
  | "token.refreshed"
  | "token.scoped"
  | "token.deleted"
  | "authorization"
  | "authorization.deleted";

type CommonOptions<TOctokit extends OAuthAppOctokitClassType> = {
  clientId?: ClientId;
  clientSecret?: ClientSecret;
  allowSignup?: boolean;
  baseUrl?: string;
  log?: typeof console;
  Octokit?: TOctokit;
};

export type Options<
  TClientType extends ClientType,
  TOctokit extends OAuthAppOctokitClassType = OAuthAppOctokitClassType
> = TClientType extends "oauth-app"
  ? CommonOptions<TOctokit> & {
      clientType?: TClientType;
      defaultScopes?: Scope[];
    }
  : CommonOptions<TOctokit> & {
      clientType?: TClientType;
    };

// workaround for https://github.com/octokit/oauth-app.js/pull/216
// we cannot make clientId & clientSecret required on Options because
// it would break inheritance of the Octokit option set via App.defaults({ Octokit })
export type ConstructorOptions<
  TOptions extends Options<ClientType>
> = TOptions & {
  clientId: ClientId;
  clientSecret: ClientSecret;
};

export type OctokitTypeFromOptions<
  TOptions extends Options<ClientType>
> = TOptions["Octokit"] extends typeof Octokit
  ? InstanceType<TOptions["Octokit"]>
  : Octokit;

export type OctokitClassTypeFromOptions<
  TOptions extends Options<ClientType>
> = TOptions["Octokit"] extends typeof Octokit
  ? TOptions["Octokit"]
  : typeof Octokit;

export type ClientTypeFromOptions<
  TOptions extends Options<ClientType>
> = TOptions["clientType"] extends "github-app" ? "github-app" : "oauth-app";

export type OctokitInstance = InstanceType<OAuthAppOctokitClassType>;
export type State = {
  clientType: ClientType;
  clientId: ClientId;
  clientSecret: ClientSecret;
  defaultScopes: Scope[];
  allowSignup?: boolean;
  baseUrl?: string;
  log?: typeof console;
  Octokit: OAuthAppOctokitClassType;
  octokit: OctokitInstance;
  eventHandlers: {
    [key: string]: EventHandler<Options<ClientType>>[];
  };
};

export type EventHandlerContext<
  TOptions extends Options<ClientType>
> = ClientTypeFromOptions<TOptions> extends "oauth-app"
  ? {
      name: EventName;
      action: ActionName;
      token: Token;
      scopes?: Scope[];
      octokit: OctokitTypeFromOptions<TOptions>;
      authentication?:
        | OAuthAppUserAuthentication
        | GitHubAppUserAuthentication
        | GitHubAppUserAuthenticationWithExpiration;
    }
  : {
      name: EventName;
      action: ActionName;
      token: Token;
      octokit: OctokitTypeFromOptions<TOptions>;
      authentication?:
        | GitHubAppUserAuthentication
        | GitHubAppUserAuthenticationWithExpiration;
    };
export type EventHandler<TOptions extends Options<ClientType>> = (
  context: EventHandlerContext<TOptions>
) => void;
export type AddEventHandler<TOptions extends Options<ClientType>> = (
  eventName: EventAndActionName | EventAndActionName[],
  eventHandler: EventHandler<TOptions>
) => void;
