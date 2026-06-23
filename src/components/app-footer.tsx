import exudusLogo from "@/assets/exudus-logo.png.asset.json";

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-background/60 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center gap-3 px-6 py-4 text-xs text-muted-foreground">
        <img
          src={exudusLogo.url}
          alt="ExudusTech"
          className="h-6 w-auto opacity-90"
          loading="lazy"
        />
        <span>
          Desenvolvido por{" "}
          <a
            href="https://exudustech.com.br"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            ExudusTech
          </a>{" "}
          — o seu hub de caminhos — todos os direitos reservados
        </span>
      </div>
    </footer>
  );
}