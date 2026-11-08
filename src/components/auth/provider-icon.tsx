import type * as React from "react";

import { cn } from "@/lib/utils/cn.ts";

export type OAuthProvider =
  "google" | "github" | "microsoft" | "apple" | "oidc";

export interface OAuthProviderIconProps extends React.ComponentProps<"svg"> {
  provider: OAuthProvider;
}

function GoogleMark(): React.ReactElement {
  return (
    <>
      <path
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
        fill="#34A853"
      />
      <path
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.29V6.62H1.29A11.99 11.99 0 0 0 0 12c0 1.94.46 3.77 1.29 5.38l3.98-3.09Z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
        fill="#EA4335"
      />
    </>
  );
}

function MicrosoftMark(): React.ReactElement {
  return (
    <>
      <path d="M2 2h9v9H2z" fill="#F25022" />
      <path d="M13 2h9v9h-9z" fill="#7FBA00" />
      <path d="M2 13h9v9H2z" fill="#00A4EF" />
      <path d="M13 13h9v9h-9z" fill="#FFB900" />
    </>
  );
}

function GitHubMark(): React.ReactElement {
  return (
    <path
      d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      fill="currentColor"
    />
  );
}

function AppleMark(): React.ReactElement {
  return (
    <path
      d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09ZM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      fill="currentColor"
    />
  );
}

function OidcMark(): React.ReactElement {
  return (
    <path
      clipRule="evenodd"
      d="M15 3a6 6 0 0 0-5.6 8.1L3 17.5V21h3.5l1-1v-2h2v-2h2l1.6-1.6A6 6 0 1 0 15 3Zm2 5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  );
}

const PROVIDER_MARKS: Record<OAuthProvider, () => React.ReactElement> = {
  apple: AppleMark,
  github: GitHubMark,
  google: GoogleMark,
  microsoft: MicrosoftMark,
  oidc: OidcMark,
};

export function OAuthProviderIcon({
  provider,
  className,
  ...props
}: OAuthProviderIconProps): React.ReactElement {
  const Mark = PROVIDER_MARKS[provider];

  return (
    <svg
      className={cn("size-4.5 sm:size-4", className)}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      aria-hidden="true"
      focusable="false"
    >
      <Mark />
    </svg>
  );
}
