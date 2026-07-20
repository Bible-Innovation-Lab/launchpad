import { getHubLink, resolveHubKind } from "./hub-kind";

function assert(cond: boolean, msg: string) {
	if (!cond) throw new Error(msg);
	console.log("ok:", msg);
}

const prev = process.env.HUB;
try {
	delete process.env.HUB;
	assert(resolveHubKind() === "scripture", "default is scripture");
	assert(resolveHubKind("community") === "community", "preferred community");
	assert(resolveHubKind("scripture") === "scripture", "preferred scripture");

	process.env.HUB = "community";
	assert(resolveHubKind("scripture") === "community", "HUB=community overrides");
	assert(getHubLink("scripture").label === "Community games", "getHubLink respects HUB");

	process.env.HUB = "scripture";
	assert(resolveHubKind("community") === "scripture", "HUB=scripture overrides");

	process.env.HUB = " other ";
	assert(resolveHubKind("community") === "community", "unknown HUB ignored");
} finally {
	if (prev === undefined) delete process.env.HUB;
	else process.env.HUB = prev;
}

console.log("\nhub-kind: all assertions passed");
