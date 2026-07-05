"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { Users, Plus, UserPlus, Crown, Shield } from "lucide-react";

export default function TeamsPage() {
  const { data: session } = useSession();
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [inviteUser, setInviteUser] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => { if (session) fetchTeams(); }, [session]);

  async function fetchTeams() {
    const res = await fetch("/api/teams");
    if (res.ok) setTeams(await res.json());
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDesc }),
    });
    if (res.ok) {
      setNewName(""); setNewDesc(""); setShowCreate(false);
      fetchTeams();
      setMessage("团队创建成功 ✅");
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteUser.trim() || !selectedTeam) return;
    const res = await fetch(`/api/teams/${selectedTeam.id}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: inviteUser }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`已邀请 ${data.username} ✅`);
      setInviteUser("");
      openTeam(selectedTeam.id);
    } else {
      setMessage("❌ " + data.error);
    }
    setTimeout(() => setMessage(""), 3000);
  }

  async function openTeam(id: string) {
    const res = await fetch(`/api/teams/${id}`);
    if (res.ok) setSelectedTeam(await res.json());
  }

  if (!session) {
    return (
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">团队</h2>
        <div className="card text-center py-16">
          <Users size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">请先登录</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">团队</h2>
        <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> 创建团队
        </button>
      </div>

      {message && <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm">{message}</div>}

      {/* 创建团队 */}
      {showCreate && (
        <form onSubmit={handleCreate} className="card mb-6">
          <h3 className="font-semibold text-gray-700 mb-3">创建新团队</h3>
          <div className="flex gap-3">
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              placeholder="团队名称" required />
            <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-accent-500/20 focus:border-accent-500"
              placeholder="团队简介（可选）" />
            <button type="submit" className="btn-primary text-sm">创建</button>
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary text-sm">取消</button>
          </div>
        </form>
      )}

      {/* 团队列表 + 详情 */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1 space-y-2">
          {teams.length === 0 ? (
            <div className="card text-center py-8">
              <Users size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm">还没有团队</p>
            </div>
          ) : (
            teams.map((team) => (
              <div key={team.id}
                onClick={() => openTeam(team.id)}
                className={`card cursor-pointer transition-all hover:shadow-md ${
                  selectedTeam?.id === team.id ? "ring-2 ring-accent-500 border-accent-500" : ""
                }`}>
                <h4 className="font-semibold text-gray-800">{team.name}</h4>
                <p className="text-xs text-gray-400 mt-1">
                  👥 {team._count.members} 成员 · 👑 {team.owner.displayName || team.owner.username}
                </p>
              </div>
            ))
          )}
        </div>

        {/* 团队详情 */}
        <div className="col-span-2">
          {selectedTeam ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">{selectedTeam.name}</h3>
                <button onClick={() => setShowInvite(!showInvite)} className="btn-secondary flex items-center gap-1 text-sm">
                  <UserPlus size={14} /> 邀请成员
                </button>
              </div>
              {selectedTeam.description && (
                <p className="text-sm text-gray-500 mb-4">{selectedTeam.description}</p>
              )}

              {showInvite && (
                <form onSubmit={handleInvite} className="flex gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
                  <input value={inviteUser} onChange={(e) => setInviteUser(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
                    placeholder="输入用户名邀请" required />
                  <button type="submit" className="btn-primary text-sm">邀请</button>
                  <button type="button" onClick={() => setShowInvite(false)} className="btn-secondary text-sm">取消</button>
                </form>
              )}

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-gray-600 mb-2">团队成员 ({selectedTeam.members?.length || 0})</h4>
                {selectedTeam.members?.map((m: any) => (
                  <div key={m.user.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                    <div className="w-8 h-8 rounded-full bg-accent-500 flex items-center justify-center text-white text-sm font-medium">
                      {(m.user.username || "?")[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{m.user.displayName || m.user.username}</p>
                      <p className="text-xs text-gray-400">@{m.user.username}</p>
                    </div>
                    <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
                      {m.role === "owner" ? <><Crown size={12} className="text-amber-500" /> 创建者</> :
                       m.role === "admin" ? <><Shield size={12} className="text-blue-500" /> 管理员</> :
                       "成员"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card text-center py-16">
              <Users size={48} className="mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">选择一个团队查看详情</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
