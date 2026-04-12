// components/fournisseurs/NouvelleCommandeModal.tsx
"use client";
import React from "react";
import { useState, useEffect, useRef } from "react";

interface Produit { _id: string; nom: string; reference: string; prixAchat: number; unite: string; }
interface Ligne { produitId: string; nomProduit: string; quantite: number; prixUnitaire: number; sousTotal: number; }

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function NouvelleCommandeModal({ onClose, onSaved }: { onClose: ()=>void; onSaved: ()=>void }) {
  const [fournisseurs, setFournisseurs] = useState<any[]>([]);
  const [boutiques, setBoutiques]       = useState<any[]>([]);
  const [produits, setProduits]         = useState<Produit[]>([]);
  const [fournisseurId, setFournisseurId] = useState("");
  const [destinationId, setDestinationId] = useState("");
  const [lignes, setLignes]             = useState<Ligne[]>([]);
  const [search, setSearch]             = useState("");
  const [dateLivraison, setDateLivraison] = useState("");
  const [note, setNote]                 = useState("");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/fournisseurs?actif=true").then(r=>r.json()),
      fetch("/api/boutiques").then(r=>r.json()),
    ]).then(([f,b]) => {
      if (f.success) setFournisseurs(f.data);
      if (b.success) setBoutiques(b.data);
    });
  }, []);

  useEffect(() => {
    if (!search) return;
    const params = new URLSearchParams({ search });
    fetch(`/api/produits?${params}`).then(r=>r.json()).then(j=>j.success&&setProduits(j.data));
  }, [search]);

  const total = lignes.reduce((s,l)=>s+l.sousTotal, 0);

  function ajouterProduit(p: Produit) {
    setLignes(prev => {
      const exist = prev.find(l=>l.produitId===p._id);
      if (exist) return prev.map(l=>l.produitId===p._id?{...l,quantite:l.quantite+1,sousTotal:(l.quantite+1)*l.prixUnitaire}:l);
      return [...prev, { produitId:p._id, nomProduit:p.nom, quantite:1, prixUnitaire:p.prixAchat, sousTotal:p.prixAchat }];
    });
    setSearch(""); searchRef.current?.focus();
  }

  function updateLigne(id: string, field: "quantite"|"prixUnitaire", val: number) {
    setLignes(prev=>prev.map(l=>l.produitId===id
      ? { ...l, [field]:val, sousTotal: field==="quantite"?val*l.prixUnitaire:l.quantite*val }
      : l
    ));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lignes.length) { setError("Ajoutez au moins un produit."); return; }
    setError(""); setLoading(true);
    const res = await fetch("/api/commandes", {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ fournisseurId, destinationId, lignes, dateLivraison, note, statut:"envoyee" }),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.success) { setError(json.message); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl card animate-slide-up flex flex-col max-h-[92vh]">

        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-lg font-bold">Nouvelle commande fournisseur</h2>
          <button type="button" onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5">

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Fournisseur *</label>
                <select className="select" value={fournisseurId} onChange={e=>setFournisseurId(e.target.value)} required>
                  <option value="">Choisir un fournisseur...</option>
                  {fournisseurs.map(f=><option key={f._id} value={f._id}>{f.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="input-label">Livrer dans *</label>
                <select className="select" value={destinationId} onChange={e=>setDestinationId(e.target.value)} required>
                  <option value="">Dépôt ou boutique...</option>
                  {boutiques.map(b=><option key={b._id} value={b._id}>{b.nom} ({b.type})</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Date de livraison prévue</label>
                <input type="date" className="input" value={dateLivraison} onChange={e=>setDateLivraison(e.target.value)} />
              </div>
              <div>
                <label className="input-label">Note</label>
                <input className="input" placeholder="Conditions, références..." value={note} onChange={e=>setNote(e.target.value)} />
              </div>
            </div>

            {/* Recherche produit */}
            <div className="border-t border-border pt-4">
              <label className="input-label">Ajouter des produits</label>
              <input ref={searchRef} className="input" placeholder="🔍  Nom ou référence du produit..."
                value={search} onChange={e=>setSearch(e.target.value)} />
              {search && produits.length > 0 && (
                <div className="mt-2 bg-surface2 border border-border rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                  {produits.map(p=>(
                    <button key={p._id} type="button" onClick={()=>ajouterProduit(p)}
                      className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-surface border-b border-border/50 last:border-0 text-left transition-colors">
                      <div>
                        <p className="text-sm font-semibold">{p.nom}</p>
                        <p className="text-[10px] font-mono text-muted">{p.reference} · {p.unite}</p>
                      </div>
                      <span className="text-xs font-mono text-accent">{fmt(p.prixAchat)} F</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lignes */}
            {lignes.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="flex items-center px-4 py-2 bg-surface2 border-b border-border text-[10px] font-mono text-muted uppercase tracking-wider">
                  <span className="flex-1">Produit</span>
                  <span className="w-24 text-center">Quantité</span>
                  <span className="w-28 text-center">Prix achat (F)</span>
                  <span className="w-24 text-right">Sous-total</span>
                  <div className="w-8" />
                </div>
                {lignes.map(l=>(
                  <div key={l.produitId} className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{l.nomProduit}</p>
                    </div>
                    <input type="number" min={0.001} step="0.001" className="w-24 input text-center text-sm font-mono py-1.5"
                      value={l.quantite} onChange={e=>updateLigne(l.produitId,"quantite",+e.target.value)} />
                    <input type="number" min={0} step="1" className="w-28 input text-center text-sm font-mono py-1.5"
                      value={l.prixUnitaire} onChange={e=>updateLigne(l.produitId,"prixUnitaire",+e.target.value)} />
                    <span className="w-24 text-right font-mono font-bold text-sm">{fmt(l.sousTotal)} F</span>
                    <button type="button" onClick={()=>setLignes(p=>p.filter(x=>x.produitId!==l.produitId))}
                      className="w-8 h-8 flex items-center justify-center text-muted hover:text-danger transition-colors">✕</button>
                  </div>
                ))}
                <div className="flex justify-between px-4 py-3 bg-surface2 border-t border-border">
                  <span className="font-bold">Total commande</span>
                  <span className="font-mono font-extrabold text-accent">{fmt(total)} F</span>
                </div>
              </div>
            )}

            {error && <div className="bg-danger/10 border border-danger/30 text-danger text-sm px-4 py-3 rounded-xl">⚠ {error}</div>}
          </div>

          <div className="px-6 py-4 border-t border-border flex gap-3 bg-surface sticky bottom-0 shrink-0">
            <button type="button" onClick={onClose} className="btn-ghost flex-1 justify-center">Annuler</button>
            <button type="submit" disabled={loading || !fournisseurId || !destinationId || !lignes.length}
              className="btn-primary flex-1 justify-center disabled:opacity-50">
              {loading ? "Création..." : `📤 Envoyer la commande (${fmt(total)} F)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
