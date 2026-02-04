import { revalidatePath } from "next/cache";
import { AuditAction, AuditEntityType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export default async function TasksPage() {
  const user = await requireUser();

  const tasks = await prisma.task.findMany({
    where: { dossier: { deletedAt: null } },
    include: { dossier: true },
    orderBy: [{ deadline: "asc" }, { createdAt: "desc" }]
  });

  async function updateStatusAction(formData: FormData) {
    "use server";

    const currentUser = await requireUser();
    if (!hasPermission(currentUser.role, "TASK", "UPDATE")) {
      throw new Error("FORBIDDEN");
    }

    const id = String(formData.get("id"));
    const status = String(formData.get("status"));

    const before = await prisma.task.findUnique({ where: { id } });
    if (!before) {
      return;
    }

    const updated = await prisma.task.update({ where: { id }, data: { status: status as "TODO" | "IN_PROGRESS" | "DONE" } });

    await writeAuditLog({
      actorUserId: currentUser.id,
      entityType: AuditEntityType.TASK,
      entityId: id,
      action: AuditAction.UPDATE,
      before,
      after: updated
    });

    revalidatePath("/tasks");
    revalidatePath(`/dossiers/${updated.dossierId}`);
    revalidatePath("/dashboard");
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tasks</h1>
      <div className="rounded border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-3 py-2">Task</th>
              <th className="px-3 py-2">Dossier</th>
              <th className="px-3 py-2">Deadline</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium">{task.title}</td>
                <td className="px-3 py-2">{task.dossier.title}</td>
                <td className="px-3 py-2">{task.deadline ? new Date(task.deadline).toLocaleString() : "-"}</td>
                <td className="px-3 py-2">{task.priority}</td>
                <td className="px-3 py-2">
                  {hasPermission(user.role, "TASK", "UPDATE") ? (
                    <form action={updateStatusAction}>
                      <input type="hidden" name="id" value={task.id} />
                      <select name="status" defaultValue={task.status} className="rounded border border-slate-300 px-2 py-1 text-xs">
                        <option value="TODO">TODO</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="DONE">DONE</option>
                      </select>
                      <button type="submit" className="ml-2 rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100">
                        Save
                      </button>
                    </form>
                  ) : (
                    task.status
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
