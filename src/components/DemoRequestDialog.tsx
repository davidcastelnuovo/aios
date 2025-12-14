import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Calendar, User, Phone, Mail, Building2, MessageSquare } from "lucide-react";

interface DemoRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DemoRequestDialog = ({ open, onOpenChange }: DemoRequestDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    company: "",
    message: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone) {
      toast.error("נא למלא שם וטלפון");
      return;
    }

    setIsSubmitting(true);
    
    // Simulate sending (in production, this would call an edge function)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast.success("הבקשה נשלחה בהצלחה! ניצור איתך קשר בהקדם");
    setFormData({ name: "", phone: "", email: "", company: "", message: "" });
    onOpenChange(false);
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#0A1526] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <Calendar className="h-6 w-6 text-[#36d399]" />
            הזמנת דמו
          </DialogTitle>
          <DialogDescription className="text-center text-white/60">
            השאירו פרטים ונחזור אליכם לתיאום הדגמה
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white/80 flex items-center gap-2">
              <User className="h-4 w-4" />
              שם מלא *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="הכנס את שמך"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#36d399]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-white/80 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              טלפון *
            </Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="050-0000000"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#36d399]"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-white/80 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              אימייל
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="your@email.com"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#36d399]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company" className="text-white/80 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              שם החברה / סוכנות
            </Label>
            <Input
              id="company"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              placeholder="שם העסק שלך"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#36d399]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message" className="text-white/80 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              הערות נוספות
            </Label>
            <Textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              placeholder="ספרו לנו קצת על הצרכים שלכם..."
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-[#36d399] resize-none"
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#36d399] hover:bg-[#36d399]/90 text-[#0A1526] font-semibold py-6 text-lg"
          >
            {isSubmitting ? "שולח..." : "שלח בקשה"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default DemoRequestDialog;
