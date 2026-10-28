import { Show, SignInButton, UserButton } from "@clerk/astro/react";
import { Button } from "@/components/ui/button";

export default function AuthButtons() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button variant="outline" size="sm" className="min-h-9" data-testid="button-sign-in">
            Sign in
          </Button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
