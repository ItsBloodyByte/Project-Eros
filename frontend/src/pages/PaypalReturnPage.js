import { useEffect, useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { AppHeader } from "../components/AppHeader";
import { AppFooter } from "../components/AppFooter";
import { Button } from "../components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function PaypalReturnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("pending"); // pending | success | error
  const [detail, setDetail] = useState("");

  useEffect(() => {
    const run = async () => {
      const orderFromUrl = params.get("token") || params.get("order_id");
      let order_id = orderFromUrl;
      try {
        const pending = JSON.parse(sessionStorage.getItem("eros_pending_paypal") || "null");
        if (!order_id && pending?.order_id) order_id = pending.order_id;
      } catch {}
      if (!order_id) {
        setStatus("error");
        setDetail("Keine Order-ID gefunden.");
        return;
      }
      try {
        const { data } = await api.post(`/payments/paypal/${encodeURIComponent(order_id)}/capture`);
        if (data?.paid) {
          setStatus("success");
          toast.success("Zahlung erfolgreich! Premium ist aktiv.");
        } else {
          setStatus("error");
          setDetail(`Status: ${data?.status || "unbekannt"}`);
        }
      } catch (e) {
        setStatus("error");
        setDetail(e.response?.data?.detail || e.message || "Unbekannter Fehler");
      } finally {
        sessionStorage.removeItem("eros_pending_paypal");
      }
    };
    run();
  }, [params]);

  return (
    <div className="app-wrap app-shell-bg-light dark:app-shell-bg">
      <div className="app-content flex flex-col min-h-screen">
        <AppHeader />
        <main className="flex-1 max-w-xl w-full mx-auto px-4 sm:px-6 py-16 text-center" data-testid="paypal-return-page">
          {status === "pending" && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-[hsl(var(--accent))]" />
              <h1 className="font-display text-2xl">Zahlung wird verarbeitet…</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Bitte dieses Fenster nicht schließen.</p>
            </div>
          )}
          {status === "success" && (
            <div className="flex flex-col items-center gap-4" data-testid="paypal-success">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <h1 className="font-display text-3xl">Vielen Dank!</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Deine Premium-Mitgliedschaft ist jetzt aktiv.</p>
              <div className="flex gap-2">
                <Button onClick={() => navigate("/account")} data-testid="go-account">Zum Konto</Button>
                <Button variant="outline" onClick={() => navigate("/")} data-testid="go-discover">Weiter entdecken</Button>
              </div>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-4" data-testid="paypal-error">
              <XCircle className="h-12 w-12 text-red-500" />
              <h1 className="font-display text-2xl">Zahlung nicht abgeschlossen</h1>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">{detail}</p>
              <Link to="/account"><Button variant="outline">Zurück zum Konto</Button></Link>
            </div>
          )}
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
