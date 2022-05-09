import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/nodes")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});