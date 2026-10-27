import SectionTitle from "@/components/common/SectionTitle";
import UserRoles from "./itadmin/UserRoles";

export default function RRHH({ fakeAction }) {
    return (
        <>
            <SectionTitle
                eyebrow="08 · RECURSOS HUMANOS"
                title="Altas y accesos"
                description="Dá de alta al personal. La clave inicial es su usuario y deberá cambiarla en el primer ingreso."
            />
            <UserRoles fakeAction={fakeAction} />
        </>
    );
}