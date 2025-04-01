# resource "aws_instance" "admin_ec2" {
#   ami           = "ami-0e86e20dae9224db8" # اوبونتو 22.04 در us-east-1
#   instance_type = "t2.micro"
#   tags = {
#     Name = "TransactionSimulatorAdmin"
#   }
# }

# output "ec2_public_ip" {
#   value = aws_instance.admin_ec2.public_ip
# }