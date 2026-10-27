import { ContentPage, contentMetadata } from "@/components/store/content-page";
import { ContactForm } from "@/components/store/contact-form";
export const generateMetadata = () => contentMetadata("contact");
export default function Page() { return <ContentPage slug="contact" extra={<ContactForm />} />; }
