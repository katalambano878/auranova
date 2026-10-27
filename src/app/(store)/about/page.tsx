import { ContentPage, contentMetadata } from "@/components/store/content-page";
export const generateMetadata = () => contentMetadata("about");
export default function Page() { return <ContentPage slug="about" />; }
