import {
  Octokit,
} from "@octokit/core";

import {
  paginateRest,
} from "@octokit/plugin-paginate-rest";
import semver from "semver";

const $Octokit = Octokit.plugin(paginateRest);

const ALLOWED_PATHS = [
  "/",
  "/vscode-releases",
  "/latest",
  "/latest-release",
];

export interface Env {
  GITHUB_TOKEN: string
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (url.host.startsWith("vscode-releases")) {
      url.pathname = "/vscode-releases";
    }

    if (url.host.startsWith("latest-vscode-release")) {
      url.pathname = "/latest-release";
    }

    if (!ALLOWED_PATHS.includes(url.pathname)) {
      return new Response("Not found", { status: 404 });
    }

    const octokit = new $Octokit({
      auth: env.GITHUB_TOKEN,
    });

    if (url.pathname === "/latest" || url.pathname === "/latest-release") {
      const { data: releases } = await octokit.request("GET /repos/{owner}/{repo}/releases", {
        owner: "microsoft",
        repo: "vscode",
        per_page: 1,
      });

      const release = releases[0];
      if (!("tag_name" in release)) {
        return new Response("Not found", { status: 404 });
      }

      return new Response(JSON.stringify({
        tag: release.tag_name,
      }), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    if (url.pathname === "/" || url.pathname === "/vscode-releases") {
      const releases = await octokit.paginate("GET /repos/{owner}/{repo}/releases", {
        owner: "microsoft",
        repo: "vscode",
        per_page: 100,
      }).then((releases) => releases.filter((release) => semver.gte(release.tag_name, "1.45.0")));

      return new Response(JSON.stringify({
        releases: releases.map((release) => ({
          tag: release.tag_name,
          url: release.url,
        })),
      }), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
