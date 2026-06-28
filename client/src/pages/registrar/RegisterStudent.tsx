import { useState } from "react";
import RegistrarLayout from "@/components/RegistrarLayout";
import { toast } from "sonner";
import { Save, User, Phone, Mail, BookOpen, CreditCard } from "lucide-react";

export default function RegisterStudent() {
  const [form, setForm] = useState({
    firstName: "", lastName: "", arabicName: "", gender: "male", dob: "", nationality: "",
    phone: "", email: "", whatsapp: "", address: "",
    course: "", branch: "", level: "", startDate: "", paymentType: "full",
    amount: "", paymentMethod: "cash", notes: "",
  });

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Student registered successfully! ID: STU-285");
  };

  const inputStyle = {
    width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid var(--border)",
    background: "var(--muted)", fontSize: 13, color: "var(--foreground)", outline: "none",
    transition: "border-color 120ms",
  };

  const labelStyle = { fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", marginBottom: 5, display: "block" };

  return (
    <RegistrarLayout>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", color: "var(--foreground)" }}>Register New Student</h1>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3 }}>Fill in the student details to create a new enrollment</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Personal Information */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <User size={14} style={{ color: "var(--muted-foreground)" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Personal Information</div>
            </div>
            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>First Name (English) *</label>
                <input style={inputStyle} value={form.firstName} onChange={e => set("firstName", e.target.value)} placeholder="Mohammed" required />
              </div>
              <div>
                <label style={labelStyle}>Last Name (English) *</label>
                <input style={inputStyle} value={form.lastName} onChange={e => set("lastName", e.target.value)} placeholder="Al-Rashid" required />
              </div>
              <div>
                <label style={labelStyle}>Full Name (Arabic)</label>
                <input style={{ ...inputStyle, direction: "rtl", fontFamily: "serif" }} value={form.arabicName} onChange={e => set("arabicName", e.target.value)} placeholder="محمد الراشد" />
              </div>
              <div>
                <label style={labelStyle}>Gender *</label>
                <select style={inputStyle} value={form.gender} onChange={e => set("gender", e.target.value)} required>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date of Birth</label>
                <input type="date" style={inputStyle} value={form.dob} onChange={e => set("dob", e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Nationality</label>
                <input style={inputStyle} value={form.nationality} onChange={e => set("nationality", e.target.value)} placeholder="Egyptian" />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <Phone size={14} style={{ color: "var(--muted-foreground)" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Contact Information</div>
            </div>
            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Phone Number *</label>
                <input style={inputStyle} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+20 100 000 0000" required />
              </div>
              <div>
                <label style={labelStyle}>WhatsApp Number</label>
                <input style={inputStyle} value={form.whatsapp} onChange={e => set("whatsapp", e.target.value)} placeholder="+20 100 000 0000" />
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input type="email" style={inputStyle} value={form.email} onChange={e => set("email", e.target.value)} placeholder="student.demo@nilelearn.local" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Address</label>
                <input style={inputStyle} value={form.address} onChange={e => set("address", e.target.value)} placeholder="Cairo, Egypt" />
              </div>
            </div>
          </div>

          {/* Course Enrollment */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <BookOpen size={14} style={{ color: "var(--muted-foreground)" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Course Enrollment</div>
            </div>
            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Course *</label>
                <select style={inputStyle} value={form.course} onChange={e => set("course", e.target.value)} required>
                  <option value="">Select course...</option>
                  <option>Standard Arabic — Level 1</option>
                  <option>Standard Arabic — Level 2</option>
                  <option>Standard Arabic — Level 3</option>
                  <option>Quran Memorization (Juz 1–5)</option>
                  <option>Quran Memorization (Juz 6–10)</option>
                  <option>Islamic Fiqh — Fundamentals</option>
                  <option>Arabic Calligraphy</option>
                  <option>Arabic Conversation — Advanced</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Branch *</label>
                <select style={inputStyle} value={form.branch} onChange={e => set("branch", e.target.value)} required>
                  <option value="">Select branch...</option>
                  <option>B1 — Cairo Main</option>
                  <option>B2 — Giza</option>
                  <option>B3 — Alexandria</option>
                  <option>Online</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Start Date *</label>
                <input type="date" style={inputStyle} value={form.startDate} onChange={e => set("startDate", e.target.value)} required />
              </div>
            </div>
          </div>

          {/* Payment */}
          <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", background: "var(--card)" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
              <CreditCard size={14} style={{ color: "var(--muted-foreground)" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Payment Details</div>
            </div>
            <div style={{ padding: "20px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Payment Type</label>
                <select style={inputStyle} value={form.paymentType} onChange={e => set("paymentType", e.target.value)}>
                  <option value="full">Full Payment</option>
                  <option value="installment">Installment</option>
                  <option value="scholarship">Scholarship</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Amount (EGP)</label>
                <input type="number" style={inputStyle} value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="2400" />
              </div>
              <div>
                <label style={labelStyle}>Payment Method</label>
                <select style={inputStyle} value={form.paymentMethod} onChange={e => set("paymentMethod", e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank Transfer</option>
                  <option value="card">Credit/Debit Card</option>
                  <option value="vodafone">Vodafone Cash</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={labelStyle}>Notes</label>
                <textarea style={{ ...inputStyle, height: 70, resize: "vertical" } as React.CSSProperties} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any additional notes..." />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button type="button" style={{ fontSize: 13, fontWeight: 500, padding: "8px 18px", borderRadius: 8, background: "var(--muted)", color: "var(--muted-foreground)", border: "1px solid var(--border)", cursor: "pointer" }}>
              Cancel
            </button>
            <button type="submit" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, padding: "8px 20px", borderRadius: 8, background: "oklch(0.55 0.18 270)", color: "white", border: "none", cursor: "pointer" }}>
              <Save size={13} /> Register Student
            </button>
          </div>
        </div>
      </form>
    </RegistrarLayout>
  );
}
