import { useEffect, useState } from "react";
import { fetchWallets } from "../lib/wallets";

// Loads the detected wallets and tracks which ones are selected for liquidation.
// Same fetch-then-state shape as the original useQuestions hook, adapted to the
// Backstop "wallets we found" screen.
export function useWallets() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState({}); // { [walletId]: boolean }

  useEffect(() => {
    // `active` guard keeps this StrictMode-safe (effects run twice in dev):
    // ignore the resolved fetch from an unmounted run.
    let active = true;
    setLoading(true);

    fetchWallets()
      .then((data) => {
        if (!active) return;
        setWallets(data);
        // Preselect the first three, matching the original wireframe default.
        setSelected(Object.fromEntries(data.map((w, i) => [w.id, i < 3])));
      })
      .catch((e) => {
        if (active) setError(e);
        console.error("failed to load wallets");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function toggle(id) {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  }

  function selectAll() {
    setSelected(Object.fromEntries(wallets.map((w) => [w.id, true])));
  }

  function clearAll() {
    setSelected({});
  }

  const selectedWallets = wallets.filter((w) => selected[w.id]);
  const selectedCount = selectedWallets.length;
  const selectedUsd = selectedWallets.reduce((sum, w) => sum + (w.usdValue ?? 0), 0);

  return {
    wallets,
    loading,
    error,
    selected,
    toggle,
    selectAll,
    clearAll,
    selectedWallets,
    selectedCount,
    selectedUsd,
    total: wallets.length,
  };
}