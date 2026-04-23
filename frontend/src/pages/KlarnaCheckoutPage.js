import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { Button } from "../components/ui/button";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

/**
 * Loads the official Klarna Payments SDK and mounts the widget
 * using a `client_token` from our backend. After user authorisation,
 * we finalise the order via /payments/klarna/place-order.
 */
function loadKlarnaSdk() {
  return new Promise((resolve, reject) => {
    if (window.Klarna?.Payments) return resolve();
    const existing = document.querySelector('script[data-eros="klarna-sdk"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const s = document.createElement("script");
    s.src = "https://x.klarnacdn.net/kp/lib/v1/api.js";
    s.async = true;
    s.dataset.eros = "klarna-sdk";
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function KlarnaCheckoutPage() {
  const [params] = useSearchParams();
  const pkgId = params.get("pkg");
  const navigate = useNavigate();
  const [pkg, setPkg] = useState(null);
  const [state, setState] = useState("init"); // init | ready | paying | success | error
  const [methods, setMethods] = useState([]);
  const [activeMethod, setActiveMethod] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const widgetRef = useRef(null);

  useEffect(() => {
    (async () => {
      if (!pkgId) {
        setState("error");
        setErrorMsg("Kein Paket übergeben.");
        return;
      }
      try {
        const { data: pkgData } = await api.get("/payments/packages");
        const found = (pkgData.packages || []).find((p) => p.id === pkgId);
        if (!found) throw new Error("Paket nicht gefunden");
        setPkg(found);
        const { data } = await api.post("/payments/klarna/create-session", { package_id: pkgId, country: "DE" });
        await loadKlarnaSdk();
        await new Promise((resolve, reject) => {
          window.Klarna.Payments.init({ client_token: data.client_token });
          resolve();
          // init has no callback; we resolve immediately
          void reject;
        });
        const cats = data.payment_method_categories || [];
        setMethods(cats);
        if (cats.length > 0) setActiveMethod(cats[0].identifier);
        setState("ready");
      } catch (e) {
        setState("error");
        setErrorMsg(e.response?.data?.detail || e.message || "Klarna konnte nicht geladen werden.");
      }
    })();
  }, [pkgId]);

  // Load widget whenever the active method changes.
  useEffect(() => {
    if (state !== "ready" || !activeMethod) return;
    try {
      window.Klarna.Payments.load(
        { container: "#klarna-widget", payment_method_category: activeMethod },
        {},
        (res) => {
          if (!res?.show_form) {
            setErrorMsg("Diese Zahlungsart ist nicht verfügbar.");
          }
        },
      );
    } catch (e) {
      setErrorMsg(e.message || "Klarna-Widget konnte nicht geladen werden.");
    }
  }, [state, activeMethod]);

  const pay = () => {
    if (!pkg || !activeMethod) return;
    setState("paying");
    try {
      window.Klarna.Payments.authorize(
        { payment_method_category: activeMethod },
        {},
        async (res) => {
          if (!res?.approved || !res.authorization_token) {
            setState("ready");
            toast.error("Klarna-Autorisierung abgelehnt.");
            return;
          }
          try {
            const { data } = await api.post("/payments/klarna/place-order", {
              package_id: pkg.id,
              authorization_token: res.authorization_token,
              country: "DE",
            });
            if (data.paid) {
              setState("success");
              toast.success("Zahlung erfolgreich!");
            } else {
              setState("error");
              setErrorMsg(`Status: ${data.fraud_status || "unbekannt"}`);
            }
          } catch (e) {
            setState("error");
            setErrorMsg(e.response?.data?.detail || e.message || "Order fehlgeschlagen");
          }
        },
      );
    } catch (e) {
      setState("error");
      setErrorMsg(e.message || "Klarna-Authorisierung fehlgeschlagen");
    }
  };

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-10 space-y-4" data-testid="klarna-checkout-page">
          <header className="pb-2">
            <div className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))] mb-2">Klarna</div>
            <h1 className="font-display text-3xl sm:text-4xl tracking-tight leading-none">Bezahlen mit Klarna</h1>
          </header>
          {pkg && (
            <div className="rounded-[var(--radius-md)] border p-4">
              <div className="font-display">{pkg.desc}</div>
              <div className="text-sm font-mono text-[hsl(var(--muted-foreground))]">
                {Number(pkg.amount).toFixed(2)} {(pkg.currency || "eur").toUpperCase()}
              </div>
            </div>
          )}

          {state === "init" && (
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
              <Loader2 className="h-4 w-4 animate-spin" /> Klarna wird vorbereitet…
            </div>
          )}

          {(state === "ready" || state === "paying") && (
            <>
              {methods.length > 1 && (
                <div className="flex flex-wrap gap-2" data-testid="klarna-methods">
                  {methods.map((m) => (
                    <button
                      key={m.identifier}
                      type="button"
                      onClick={() => setActiveMethod(m.identifier)}
                      className={
                        "rounded-full border px-3 py-1 text-xs transition-colors " +
                        (activeMethod === m.identifier
                          ? "bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))] border-transparent"
                          : "hover:border-[hsl(var(--accent))]/60")
                      }
                      data-testid={`klarna-method-${m.identifier}`}
                    >
                      {m.name || m.identifier}
                    </button>
                  ))}
                </div>
              )}
              <div id="klarna-widget" ref={widgetRef} className="min-h-[120px] rounded-[var(--radius-md)] border p-2" data-testid="klarna-widget" />
              <Button onClick={pay} disabled={state === "paying" || !activeMethod} className="w-full" data-testid="klarna-pay-btn">
                {state === "paying" ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Wird autorisiert…</> : "Jetzt bezahlen"}
              </Button>
            </>
          )}

          {state === "success" && (
            <div className="flex flex-col items-center gap-4 py-8" data-testid="klarna-success">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <h2 className="font-display text-2xl">Vielen Dank!</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Deine Premium-Mitgliedschaft ist aktiv.</p>
              <Button onClick={() => navigate("/account")} data-testid="klarna-go-account">Zum Konto</Button>
            </div>
          )}

          {state === "error" && (
            <div className="flex flex-col items-center gap-4 py-8" data-testid="klarna-error">
              <XCircle className="h-12 w-12 text-red-500" />
              <h2 className="font-display text-2xl">Zahlung fehlgeschlagen</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{errorMsg}</p>
              <Link to="/account"><Button variant="outline">Zurück zum Konto</Button></Link>
            </div>
          )}
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
