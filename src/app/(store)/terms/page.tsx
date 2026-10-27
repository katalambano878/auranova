import { ContentPage, contentMetadata } from "@/components/store/content-page";
export const generateMetadata = () => contentMetadata("terms");
export default function Page() { return <ContentPage slug="terms" />; }
