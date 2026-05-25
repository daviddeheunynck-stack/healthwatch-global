import Link from "next/link";
import { Activity } from "lucide-react";

interface FooterProps {
  locale: string;
}

export default function Footer({ locale }: FooterProps) {
  return (
    <footer className="border-t border-gray-800 bg-gray-900/50 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Activity className="w-4 h-4 text-red-500" />
            <span className="font-semibold text-gray-400">HealthWatch Global</span>
            <span>·</span>
            <span>© {new Date().getFullYear()}</span>
          </div>

          {/* Links */}
          <nav className="flex items-center gap-5 text-xs text-gray-500">
            <Link href={`/${locale}/privacy`} className="hover:text-gray-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href={`/${locale}/terms`} className="hover:text-gray-300 transition-colors">
              Terms of Service
            </Link>
            <Link href={`/${locale}/contact`} className="hover:text-gray-300 transition-colors">
              Contact
            </Link>
            <a
              href="mailto:contact@healthwatch-global.com"
              className="hover:text-gray-300 transition-colors"
            >
              contact@healthwatch-global.com
            </a>
          </nav>

        </div>
      </div>
    </footer>
  );
}
