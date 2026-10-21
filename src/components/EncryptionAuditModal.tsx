import React, { useState } from 'react';
import { Lock, ShieldCheck, Key, Hash, FileCheck, Check, Copy } from 'lucide-react';

interface EncryptionAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoTitle: string;
  encryptionAlgorithm?: string;
  encryptionKeyId?: string;
  encryptionHash?: string;
  duration?: string;
}

export const EncryptionAuditModal: React.FC<EncryptionAuditModalProps> = ({
  isOpen,
  onClose,
  videoTitle,
  encryptionAlgorithm = 'AES-256-GCM',
  encryptionKeyId = 'key_sec_91b72a0f',
  encryptionHash = 'sha256-7fa9b28c891e48f07ad931be64175acbd781',
  duration = '18:42',
}) => {
  const [copied, setCopied] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-neutral-200">
        <div className="flex items-center gap-3 border-b border-neutral-800 pb-4 mb-4">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              Encrypted Media Storage Audit
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500 text-black font-semibold">
                ACTIVE
              </span>
            </h3>
            <p className="text-xs text-neutral-400 truncate max-w-sm">{videoTitle}</p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          <div className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 space-y-2 font-mono">
            <div className="flex justify-between items-center text-neutral-400">
              <span className="flex items-center gap-1.5 text-neutral-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Cipher Architecture
              </span>
              <span className="text-emerald-400 font-semibold">{encryptionAlgorithm}</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span className="flex items-center gap-1.5 text-neutral-300">
                <Key className="w-4 h-4 text-amber-400" /> Key Derivation
              </span>
              <span>WebCrypto SubtleCrypto (256-bit)</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span className="flex items-center gap-1.5 text-neutral-300">
                <FileCheck className="w-4 h-4 text-sky-400" /> Initialization Vector
              </span>
              <span>96-bit Random Nonce per Chunk</span>
            </div>
            <div className="flex justify-between items-center text-neutral-400">
              <span className="text-neutral-300">Auth Tag Length</span>
              <span>128-bit MAC Integrity</span>
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 mb-1 font-medium">Cryptographic Fingerprint & Key ID</label>
            <div className="flex items-center gap-2 p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 font-mono text-[11px] text-amber-400">
              <span className="truncate flex-1">{encryptionKeyId}</span>
              <button
                onClick={() => copyToClipboard(encryptionKeyId, 'key')}
                className="hover:text-white p-1 rounded transition-colors text-neutral-400"
                title="Copy Key Fingerprint"
              >
                {copied === 'key' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 mb-1 font-medium">SHA-256 Tamper-Proof Audit Hash</label>
            <div className="flex items-center gap-2 p-2.5 bg-neutral-950 rounded-lg border border-neutral-800 font-mono text-[11px] text-neutral-300">
              <span className="truncate flex-1">{encryptionHash}</span>
              <button
                onClick={() => copyToClipboard(encryptionHash, 'hash')}
                className="hover:text-white p-1 rounded transition-colors text-neutral-400"
                title="Copy Hash"
              >
                {copied === 'hash' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-neutral-300 leading-relaxed">
            <p className="font-medium text-amber-400 mb-1 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Institutional Zero-Knowledge Standard
            </p>
            Lectures are protected at rest and stream-decrypted client-side. Proprietary educational content cannot be decrypted without verified role access tokens and valid student or faculty keys.
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white transition-colors cursor-pointer"
          >
            Close Audit Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
