const devices = [
  {
    addresses: "dev1",
  },
  {
    addresses: "dev2",
  },
];

if (Array.isArray(devices)) {
  devices.forEach((device) => {
    console.log(device.addresses);
  });
} else {
  console.log("devices is not an array");
}
