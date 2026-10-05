import { useParams, Link } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { DeviceControl, DeviceIcon, isSensorDevice } from "@/components/devices/DeviceControl";
import { PageHeading, PanelHeading } from "@/components/FamilyPlanner";
import { StateWrapper } from "@/components/common/StateWrapper";
export default function DeviceDetail() {
  const { deviceId } = useParams();
  const { currentHome, homeOnline } = useApp();
  const room = currentHome?.rooms.find(r => r.devices.some(d => d.id === deviceId));
  const device = room?.devices.find(d => d.id === deviceId);
  if (!device) return <StateWrapper state="empty" emptyTitle="Device not found" emptyDescription="This device is no longer in this home."><Link to="/devices">Back to devices</Link></StateWrapper>;
  const readable = device.attributes.filter(a => !["isOn", "brightness", "targetTemperature", "lockState", "isOpen", "position", "charging", "chargeLimit"].includes(a.name));
  return <div className="planner-page"><Link to="/devices" aria-label="Back to devices" className="text-link"><ArrowLeft size={17} />Devices</Link><PageHeading eyebrow={room.name.toUpperCase()} title={device.name} description={`${device.vendor} ${device.model} · ${device.displayType}`}><span className="device-symbol"><DeviceIcon type={device.type} className="h-6 w-6" /></span></PageHeading>
    {device.troubleshooting && <div className="home-alert"><AlertCircle /><span>{device.troubleshooting}</span></div>}
    <div className="smart-bottom"><section className="glow-panel"><PanelHeading title={isSensorDevice(device.type) ? "Current reading" : "Make yourself comfortable"} /><DeviceControl device={device} /><p className="page-note">{!device.online || !homeOnline ? "Readings are last known. Controls are unavailable while offline." : "Demo device · Changes are shared across this session."}</p></section>
      <section className="glow-panel"><PanelHeading title="At a glance" /><dl className="device-readings">{readable.map(attr => <div key={attr.name}><dt>{attr.name.replace(/([A-Z])/g, " $1")}</dt><dd>{!homeOnline || !device.online ? "Unavailable" : typeof attr.value === "boolean" ? (attr.value ? "Yes" : "No") : `${attr.value}${attr.unit ?? ""}`}</dd></div>)}<div><dt>Connection</dt><dd>{homeOnline && device.online ? "Online" : "Offline"}</dd></div><div><dt>Room</dt><dd><Link to={`/rooms/${room.id}`}>{room.name}</Link></dd></div><div><dt>Software</dt><dd>{device.softwareVersion}</dd></div></dl></section></div>
    {device.softwareUpdate && <p className="page-note">Software version {device.softwareUpdate.version} is available in the sample data. Firmware updates require a connected home hub.</p>}
  </div>;
}
