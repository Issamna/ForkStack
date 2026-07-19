import { useParams } from "react-router-dom";

export default function RecipeDetailPage() {
  const { id } = useParams();
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="heading-primary">Recipe</h1>
      <p className="text-subtle mt-2">Detail for {id} — ported in Stage 3.</p>
    </div>
  );
}
