'use client';

import { useState } from 'react';
import { X, MessageCircle, Phone, Mail, Globe, Check } from 'lucide-react';
import { Project, Media } from '@/types/hierarchy.types';

interface ContactModalProps {
  project: Project;
  logos: Media[];
  open: boolean;
  onClose: () => void;
}

export function ContactModal({ project, logos, open, onClose }: ContactModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!open) return null;

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const phones = project.phone?.split(' / ') ?? [];
  const whatsappClean = project.whatsapp?.replace(/\D/g, '') ?? '';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-sm p-6 text-white relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-white/10 transition-colors outline-none"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5 text-white/70" />
        </button>

        {/* Logo */}
        {logos.length > 0 && (
          <div className="flex justify-center mb-4">
            <img
              src={logos[logos.length > 1 ? 1 : 0].url!}
              alt=""
              className="h-10 w-auto"
            />
          </div>
        )}

        <h2 className="text-lg font-semibold text-center mb-5">Contacto</h2>

        <div className="space-y-3">
          {/* WhatsApp */}
          {project.whatsapp && (
            <a
              href={`https://wa.me/${whatsappClean}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors"
            >
              <MessageCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div>
                <div className="text-xs text-white/50">WhatsApp</div>
                <div className="text-sm font-medium">{project.whatsapp}</div>
              </div>
            </a>
          )}

          {/* Phones */}
          {phones.map((phone, i) => (
            <button
              key={i}
              onClick={() => copyToClipboard(phone.trim(), `phone-${i}`)}
              className="w-full flex items-center gap-3 bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors text-left"
            >
              <Phone className="w-5 h-5 text-white/60 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs text-white/50">Tel&eacute;fono</div>
                <div className="text-sm font-medium">{phone.trim()}</div>
              </div>
              {copiedField === `phone-${i}` && (
                <Check className="w-4 h-4 text-green-400" />
              )}
            </button>
          ))}

          {/* Email */}
          {project.email && (
            <button
              onClick={() => copyToClipboard(project.email!, 'email')}
              className="w-full flex items-center gap-3 bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors text-left"
            >
              <Mail className="w-5 h-5 text-white/60 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-xs text-white/50">Email</div>
                <div className="text-sm font-medium">{project.email}</div>
              </div>
              {copiedField === 'email' && (
                <Check className="w-4 h-4 text-green-400" />
              )}
            </button>
          )}

          {/* Website */}
          {project.website && (
            <a
              href={
                project.website.startsWith('http')
                  ? project.website
                  : `https://${project.website}`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white/5 rounded-lg p-3 hover:bg-white/10 transition-colors"
            >
              <Globe className="w-5 h-5 text-white/60 flex-shrink-0" />
              <div>
                <div className="text-xs text-white/50">Web</div>
                <div className="text-sm font-medium">{project.website}</div>
              </div>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
