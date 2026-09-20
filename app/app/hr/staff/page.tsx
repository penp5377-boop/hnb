"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { LoadingState } from "@/components/shared/loading-state";
import { ErrorState } from "@/components/shared/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/lib/types/database";
import { Plus, Search, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

type Staff = Database["public"]["Tables"]["hr_staff"]["Row"];

type StaffWithProfile = Staff & {
  profiles: { first_name: string; last_name: string; phone: string | null } | null;
};

const STATUS_OPTIONS = [
  { value: "active", label: "Actif" },
  { value: "on_leave", label: "En congé" },
  { value: "terminated", label: "Licencié" },
  { value: "retired", label: "Retraité" },
];

const EMPLOYMENT_TYPES = [
  { value: "cdi", label: "CDI" },
  { value: "cdd", label: "CDD" },
  { value: "internship", label: "Stage" },
  { value: "consultant", label: "Consultant" },
];

export default function StaffPage() {
  const { permissions, profile } = useAuth();
  const { toast } = useToast();

  const [staff, setStaff] = useState<StaffWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Staff | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canCreate = permissions.includes("hr.create" as never);
  const canUpdate = permissions.includes("hr.update" as never);
  const canDelete = permissions.includes("hr.delete" as never);

  const fetchStaff = useCallback(async () => {
    if (!profile?.institution_id) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("hr_staff")
        .select("*, profiles(first_name, last_name, phone)")
        .eq("institution_id", profile.institution_id)
        .order("created_at", { ascending: false });
      if (err) throw err;
      setStaff((data as StaffWithProfile[]) ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }, [profile?.institution_id]);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const filtered = staff.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const fullName = `${s.profiles?.last_name ?? ""} ${s.profiles?.first_name ?? ""}`.toLowerCase();
    return s.staff_number.toLowerCase().includes(q) || fullName.includes(q);
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from("hr_staff").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      toast({ title: "Personnel supprimé" });
      setDeleteTarget(null);
      fetchStaff();
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <div><PageHeader title="Personnel" description="Gestion du personnel administratif et support" /><LoadingState /></div>;
  }
  if (error) {
    return <div><PageHeader title="Personnel" description="Gestion du personnel" /><ErrorState message={error} action={<Button variant="outline" size="sm" onClick={fetchStaff}>Réessayer</Button>} /></div>;
  }

  return (
    <div>
      <PageHeader
        title="Personnel"
        description="Gestion du personnel administratif et support"
        action={canCreate && (
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouveau membre
          </Button>
        )}
      />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher par nom ou numéro..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Tous les statuts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              {STATUS_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Aucun personnel" message="Aucun membre du personnel trouvé." action={canCreate && (
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus className="w-4 h-4 mr-2" /> Ajouter</Button>
          )} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Numéro</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Embauche</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const fullName = `${s.profiles?.first_name ?? "—"} ${s.profiles?.last_name ?? ""}`.trim();
                  const initials = `${s.profiles?.first_name?.[0] ?? "?"}${s.profiles?.last_name?.[0] ?? ""}`.toUpperCase();
                  const statusLabel = STATUS_OPTIONS.find((o) => o.value === s.status)?.label ?? s.status;
                  const empLabel = EMPLOYMENT_TYPES.find((o) => o.value === s.employment_type)?.label ?? s.employment_type ?? "—";
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs bg-primary text-white">{initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{fullName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{s.staff_number}</TableCell>
                      <TableCell className="text-muted-foreground">{empLabel}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{new Date(s.hire_date).toLocaleDateString("fr-FR")}</TableCell>
                      <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{statusLabel}</Badge></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canUpdate && <DropdownMenuItem onClick={() => { setEditing(s); setFormOpen(true); }}><Pencil className="w-4 h-4 mr-2" /> Modifier</DropdownMenuItem>}
                            {canDelete && <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(s)}><Trash2 className="w-4 h-4 mr-2" /> Supprimer</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <StaffFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        staff={editing}
        institutionId={profile?.institution_id ?? ""}
        onSaved={fetchStaff}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce membre du personnel ?</AlertDialogTitle>
            <AlertDialogDescription>Êtes-vous sûr de vouloir supprimer « {deleteTarget?.staff_number} » ? Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StaffFormDialog({
  open, onOpenChange, staff, institutionId, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff | null;
  institutionId: string;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [staffNumber, setStaffNumber] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [status, setStatus] = useState("active");
  const [employmentType, setEmploymentType] = useState("");
  const [personalEmail, setPersonalEmail] = useState("");
  const [personalPhone, setPersonalPhone] = useState("");
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (open) {
      setStaffNumber(staff?.staff_number ?? "");
      setHireDate(staff?.hire_date ?? new Date().toISOString().slice(0, 10));
      setStatus(staff?.status ?? "active");
      setEmploymentType(staff?.employment_type ?? "");
      setPersonalEmail(staff?.personal_email ?? "");
      setPersonalPhone(staff?.personal_phone ?? "");
      setAddress(staff?.address ?? "");
    }
  }, [open, staff]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffNumber.trim()) {
      toast({ title: "Champ requis", description: "Le numéro de personnel est obligatoire.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        institution_id: institutionId,
        staff_number: staffNumber.trim(),
        hire_date: hireDate,
        status,
        employment_type: employmentType || null,
        personal_email: personalEmail.trim() || null,
        personal_phone: personalPhone.trim() || null,
        address: address.trim() || null,
      };

      if (staff) {
        const { error: err } = await supabase.from("hr_staff").update(payload).eq("id", staff.id);
        if (err) throw err;
        toast({ title: "Personnel mis à jour" });
      } else {
        const { error: err } = await supabase.from("hr_staff").insert(payload);
        if (err) throw err;
        toast({ title: "Personnel créé" });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Une erreur est survenue.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{staff ? "Modifier le personnel" : "Nouveau membre du personnel"}</DialogTitle>
          <DialogDescription>Enregistrez un membre du personnel administratif ou support.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff-num">Numéro *</Label>
              <Input id="staff-num" value={staffNumber} onChange={(e) => setStaffNumber(e.target.value)} disabled={saving} placeholder="PERS-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-hire">Date d'embauche</Label>
              <Input id="staff-hire" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} disabled={saving} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff-status">Statut</Label>
              <Select value={status} onValueChange={setStatus} disabled={saving}>
                <SelectTrigger id="staff-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-type">Type d'emploi</Label>
              <Select value={employmentType} onValueChange={setEmploymentType} disabled={saving}>
                <SelectTrigger id="staff-type"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {EMPLOYMENT_TYPES.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="staff-email">Email personnel</Label>
              <Input id="staff-email" type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} disabled={saving} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-phone">Téléphone</Label>
              <Input id="staff-phone" value={personalPhone} onChange={(e) => setPersonalPhone(e.target.value)} disabled={saving} placeholder="+221 ..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-addr">Adresse</Label>
            <Input id="staff-addr" value={address} onChange={(e) => setAddress(e.target.value)} disabled={saving} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : staff ? "Enregistrer" : "Créer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
