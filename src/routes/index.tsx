import { ClientOnly, createFileRoute } from "@tanstack/react-router";
import { GameExperience } from "../game/Experience";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "O Bairro — Vida de Rua" },
      {
        name: "description",
        content: "Explora o bairro, conhece a malta e descobre o teu lugar neste mundo aberto em 3D.",
      },
      { property: "og:title", content: "O Bairro — Vida de Rua" },
      {
        property: "og:description",
        content: "Um bairro em 3D para explorar, conversar e viver a rua.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <ClientOnly fallback={<main className="game-loading">A preparar o bairro…</main>}>
      <GameExperience />
    </ClientOnly>
  );
}
